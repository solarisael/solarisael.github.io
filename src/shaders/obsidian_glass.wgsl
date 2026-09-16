import { linearToSrgb3 } from "@vgpu/wgsl-std/color";
import { Ink } from "./portal_ink_types.wgsl";
import { ink_coverage } from "./portal_ink_coverage.wgsl";

struct Glass {
  resolution: vec2f,
  tablet_size: vec2f,
  tablet_origin: vec2f,
  field_offset: vec2f,
  halo: f32,
  rim: f32,
  time: f32,
  depth_regions: array<vec4f, 16>,
  depth_params: array<vec4f, 16>,
  depth_count: f32,
  sdr: f32,
  button_regions: array<vec4f, 16>,
  button_bounds: vec4f,
  button_count: f32,
  scheme: f32,
}
@group(0) @binding(0) var fracture_field: texture_2d<f32>;
@group(0) @binding(1) var diffuse_field: texture_2d<f32>;
@group(0) @binding(2) var field_sampler: sampler;
@group(0) @binding(3) var<uniform> glass: Glass;
@group(0) @binding(4) var emission_field: texture_2d<f32>;
@group(0) @binding(5) var fog_field: texture_2d<f32>;

struct Water {
  absorption: f32,
  near_depth: f32,
  far_depth: f32,
  wave_depth: f32,
}
@group(0) @binding(6) var<uniform> water: Water;
@group(0) @binding(7) var<uniform> ink: Ink;
@group(0) @binding(8) var plume_field: texture_2d<f32>;
@group(0) @binding(9) var plume_sampler: sampler;

struct Current {
  near_offset: vec2f,
  far_offset: vec2f,
  weights: vec2f,
  gradient: vec2f,
  height: f32,
  depression: vec3f,
}
var<private> current: Current;

// Positive depth points into the basin; xy is its tablet-local spatial gradient.
fn sample_depression(local: vec2f) -> vec3f {
  var depression = vec3f(0.0);
  for (var i = 0u; i < min(u32(glass.depth_count), 16u); i++) {
    let region = glass.depth_regions[i];
    let params = glass.depth_params[i];
    let delta = local - region.xy;
    let q = length(delta / region.zw);
    if (q >= 1.0 || params.x <= 0.0) {
      continue;
    }
    let shoulder = 1.0 - params.y;
    let t = clamp((1.0 - q) / shoulder, 0.0, 1.0);
    let depth = params.x * t * t * (3.0 - 2.0 * t);
    if (depth > depression.z) {
      var gradient = vec2f(0.0);
      if (q > params.y) {
        gradient = -params.x * 6.0 * t * (1.0 - t) / shoulder
          * (delta / (region.zw * region.zw)) / max(q, 0.0001);
      }
      depression = vec3f(gradient, depth);
    }
  }
  return depression;
}

fn sample_current(point: vec2f) -> Current {
  let world = point / 1920.0 + glass.field_offset;
  let seed = textureSampleLevel(fog_field, field_sampler, world * 1.3, 0.0).rgb;
  let detail = textureSampleLevel(fog_field, field_sampler, world * 2.3 + vec2f(0.37, 0.61), 0.0).rgb;
  let angle_a = seed.r * 12.5663706;
  let angle_b = detail.g * 12.5663706;
  let direction_a = vec2f(cos(angle_a), sin(angle_a));
  let direction_b = vec2f(cos(angle_b), sin(angle_b));
  let near_offset = direction_a * sin(glass.time * 0.1 + seed.b * 6.2831853) * 0.095
    + direction_b * cos(glass.time * 0.07 + seed.r * 6.2831853) * 0.045;
  let far_offset = direction_b * sin(glass.time * 0.065 + detail.b * 6.2831853) * 0.038
    + direction_a * cos(glass.time * 0.09 + detail.r * 6.2831853) * 0.025 + vec2f(0.65, 0.41);
  let phase_a = dot(point, direction_a) * 0.018 - glass.time * (0.21 + seed.g * 0.17) + seed.r * 6.2831853;
  let phase_b = dot(point, direction_b) * 0.031 + glass.time * 0.13 + detail.b * 6.2831853;
  let height = 0.5 + 0.5 * (sin(phase_a) * 0.6 + sin(phase_b) * 0.4);
  let gradient = direction_a * cos(phase_a) * 0.6 + direction_b * cos(phase_b) * 0.4;
  let heights = textureSampleLevel(
    fog_field, field_sampler, world + near_offset * 0.3 + vec2f(glass.time * 0.001), 0.0
  ).rg;
  let overlap = smoothstep(-0.12, 0.12, heights.r - heights.g + (height - 0.5) * 0.16);
  let depression = sample_depression(point + glass.tablet_size * 0.5);
  var flow = Current(
    near_offset, far_offset,
    vec2f(mix(0.55, 1.0, overlap), mix(0.4, 0.1, overlap)),
    gradient, height, depression
  );
  if (depression.z > 0.0) {
    flow.height = max(0.0, flow.height - depression.z / 96.0);
    flow.gradient -= depression.xy * 0.5;
    // One optical deformation owns fracture, diffuse, and emission sampling.
    flow.near_offset += (-depression.xy * 12.0 + vec2f(0.0, depression.z * 0.3)) / 640.0;
    flow.far_offset += (-depression.xy * 24.0 + vec2f(0.0, depression.z * 0.65)) / 640.0;
    let transfer = flow.weights.x * 0.28 * depression.z / (depression.z + 48.0);
    flow.weights += vec2f(-transfer, transfer);
  }
  let optical_depth = vec2f(water.near_depth, water.far_depth)
    + vec2f(height * height * water.wave_depth + depression.z);
  flow.weights *= exp(-water.absorption * max(optical_depth, vec2f(0.0)));
  return flow;
}

fn film(color: vec3f) -> vec3f {
  return vec3f(1.0) - exp(-color);
}

// Keep optical distances in the original units while the baked world spans three tiles.
fn fracture_at(uv: vec2f) -> vec4f {
  let near_layer = textureSampleLevel(
    fracture_field, field_sampler, (uv + current.near_offset) / 3.0 + glass.field_offset, 0.0
  );
  let far_layer = textureSampleLevel(
    fracture_field, field_sampler, (uv + current.far_offset) / 3.0 + glass.field_offset, 0.0
  );
  let near_light = near_layer.rgb * current.weights.x;
  let far_light = far_layer.rgb * current.weights.y;
  let orientation = select(far_layer.a, near_layer.a, max(near_light.r, near_light.g) >= max(far_light.r, far_light.g));
  return vec4f(near_light + far_light, orientation);
}

fn diffuse_at(uv: vec2f) -> vec3f {
  let near_light = textureSampleLevel(
    diffuse_field, field_sampler, (uv + current.near_offset) / 3.0 + glass.field_offset, 0.0
  ).rgb;
  let far_light = textureSampleLevel(
    diffuse_field, field_sampler, (uv + current.far_offset) / 3.0 + glass.field_offset, 0.0
  ).rgb;
  return near_light * current.weights.x + far_light * current.weights.y;
}

fn emission_at(uv: vec2f) -> vec3f {
  let near_light = textureSampleLevel(
    emission_field, field_sampler, (uv + current.near_offset) / 3.0 + glass.field_offset, 0.0
  ).rgb;
  let far_light = textureSampleLevel(
    emission_field, field_sampler, (uv + current.far_offset) / 3.0 + glass.field_offset, 0.0
  ).rgb;
  return near_light * current.weights.x + far_light * current.weights.y;
}

fn emission_energy(uv: vec2f) -> f32 {
  let light = emission_at(uv);
  return max(max(light.r, light.g), light.b);
}

fn fracture_lean(uv: vec2f, normal: vec2f, tangent: vec2f) -> f32 {
  let angle = fracture_at(uv).a * 3.14159265;
  let direction = vec2f(cos(angle), sin(angle));
  let outward = select(direction, -direction, dot(direction, normal) < 0.0);
  return clamp(dot(outward, tangent) / max(dot(outward, normal), 0.3), -0.65, 0.65);
}

fn smoke_field(world_uv: vec2f) -> vec3f {
  let mist_uv = world_uv * 2.1 + vec2f(glass.time * -0.007, glass.time * 0.01);
  let layers = textureSampleLevel(fog_field, field_sampler, mist_uv, 0.0).rgb;
  let fold_uv = world_uv * 0.9 + vec2f(0.37, 0.19)
    + vec2f(glass.time * 0.004, glass.time * -0.006)
    + (layers.rg - vec2f(0.5)) * 0.12;
  let folds = textureSampleLevel(fog_field, field_sampler, fold_uv, 0.0).rg;
  let density = smoothstep(0.34, 0.67, mix(layers.r, folds.g, 0.4));
  let tide = 0.5 + 0.5 * sin(glass.time * 0.23 + folds.r * 8.0 + layers.b * 4.0);
  return vec3f(density, folds.r, tide);
}

fn atmosphere(field_uv: vec2f, energy: f32, diffused: vec3f, distance: f32) -> vec4f {
  let world_uv = field_uv + (glass.tablet_origin + glass.tablet_size * 0.5) / 640.0;
  let smoke = smoke_field(world_uv);
  let reach = max(glass.halo, 1.0);
  let wave = 0.5 + 0.5 * sin(distance / reach * 7.0 - glass.time * 0.37 + smoke.y * 9.0);
  let density = smoke.x * mix(0.45, 1.0, smoothstep(0.2, 0.8, wave));
  let envelope = exp(-distance / (reach * 0.55));
  let illumination = smoothstep(0.04, 0.7, energy);
  let scattered = density * envelope * illumination * mix(0.35, 0.65, smoke.z);
  let shadow = density * envelope * (1.0 - illumination) * 0.28;
  let tint = mix(vec3f(0.95, 0.92, 0.8), film(diffused * 4.0), 0.25);
  let radiance = tint * scattered
    + vec3f(1.0, 0.975, 0.90) * shadow * (1.0 - scattered) * glass.scheme;
  return vec4f(radiance, scattered + shadow * (1.0 - scattered));
}

fn water_spill(mist: vec4f, field_uv: vec2f, normal: vec2f, coverage: f32) -> vec4f {
  let crest = smoothstep(0.56, 0.88, current.height);
  let bent_uv = field_uv + current.gradient * 0.009 + normal * crest * 0.012;
  let illumination = smoothstep(0.04, 0.65, emission_energy(bent_uv));
  let body_alpha = coverage * crest * 0.2;
  let glint_alpha = coverage * crest * illumination * 0.28;
  let fracture = fracture_at(bent_uv).rgb;
  let dark_caustic = smoothstep(0.03, 0.8, max(max(fracture.r, fracture.g), fracture.b));
  let transmitted = mix(film(fracture * 0.22),
    mix(vec3f(1.0, 0.975, 0.90), vec3f(0.002, 0.0025, 0.003), dark_caustic), glass.scheme);
  let glint_tint = mix(vec3f(0.97, 0.95, 0.86), vec3f(0.002, 0.0025, 0.003), glass.scheme);
  let color = transmitted * body_alpha * (1.0 - glint_alpha) + glint_tint * glint_alpha;
  let alpha = body_alpha + glint_alpha * (1.0 - body_alpha);
  return vec4f(color + mist.rgb * (1.0 - alpha), alpha + mist.a * (1.0 - alpha));
}

fn basin_surface(
  local: vec2f, edge_distance: f32, edge_normal: vec2f,
  field_uv: vec2f, diffused: vec3f
) -> vec3f {
  let inner_distance = edge_distance - glass.rim;
  let wall_width = clamp(min(glass.tablet_size.x, glass.tablet_size.y) * 0.075, 14.0, 36.0);
  let wall_progress = clamp(inner_distance / wall_width, 0.0, 1.0);
  let depth = smoothstep(0.0, 1.0, wall_progress);
  let slope = sin(wall_progress * 3.14159265);
  let ripple = vec2f(
    sin(local.y * 0.023 + glass.time * 0.17 + sin(local.x * 0.009)),
    cos(local.x * 0.019 - glass.time * 0.13 + sin(local.y * 0.011))
  );
  let curved_uv = field_uv - edge_normal * slope * 0.035
    + vec2f(0.0, depth * 0.018) + ripple * mix(0.004, 0.009, depth)
    + current.gradient * depth * 0.006;
  let transmission = fracture_at(curved_uv).rgb;
  let reflection = fracture_at(field_uv + edge_normal * slope * 0.024 - ripple * 0.005).rgb;
  let red = fracture_at(curved_uv + ripple * 0.001).r;
  let blue = fracture_at(curved_uv - ripple * 0.001).b;
  let inward_light = 0.5 + dot(-edge_normal, normalize(vec2f(-0.6, -0.8))) * 0.12;
  let edge_glint = exp(-inner_distance / 1.1)
    + exp(-abs(inner_distance - wall_width) / 1.2);
  let waterline = wall_width * (1.0 - current.height * 0.7);
  let water_glint = exp(-abs(inner_distance - waterline) / 1.3) * current.height;
  let contact_shadow = exp(-inner_distance / (wall_width * 0.7))
    * mix(0.5, 0.2, inward_light) * mix(1.0, 0.12, glass.scheme);
  let fresnel = 0.07 + edge_glint * 0.3;
  let shadow_stone = mix(vec3f(0.009, 0.007, 0.015), vec3f(0.004, 0.006, 0.009), depth);
  let light_stone = mix(vec3f(2.4, 2.25, 1.9), vec3f(1.55, 1.5, 1.3), depth);
  let stone = mix(shadow_stone, light_stone, glass.scheme);
  let energy = emission_energy(curved_uv);
  let caustics = vec3f(red, transmission.g, blue) * mix(0.56, 0.38, depth)
    + reflection * fresnel * 0.45;
  let radiance = stone + caustics + diffused * 0.08
    + vec3f(0.12, 0.115, 0.1) * (edge_glint + water_glint * 0.3)
      * smoothstep(0.06, 0.5, energy);
  var glass_color = film(radiance);
  if (glass.scheme > 0.5) {
    let ink = smoothstep(0.012, 0.35, max(max(caustics.r, caustics.g), caustics.b));
    glass_color = mix(film(stone), vec3f(0.002, 0.0025, 0.003), ink);
  }
  glass_color *= (1.0 - contact_shadow) * (1.0 - slope * mix(0.18, 0.025, glass.scheme));

  // The lip hides the crossing smoke; the same world field feeds both sides.
  let world_uv = (glass.tablet_origin + local) / 640.0;
  let smoke = smoke_field(world_uv + edge_normal * inner_distance / 1600.0);
  let crest = smoothstep(0.58, 0.94, smoke.z);
  let reach = max(glass.halo, 1.0) * mix(0.3, 3.0, crest);
  let spill = exp(-inner_distance / reach)
    * (1.0 - smoothstep(reach * 0.7, reach * 1.5, inner_distance));
  let lip_occlusion = smoothstep(0.0, wall_width * 0.45, inner_distance);
  let density = smoke.x * crest * spill * lip_occlusion;
  let illumination = smoothstep(0.04, 0.7, energy);
  let scattered = density * illumination * 0.32;
  let shadow = density * (1.0 - illumination) * mix(0.48, 0.025, glass.scheme);
  let tint = mix(vec3f(0.95, 0.92, 0.8), film(diffused * 4.0), 0.25);
  let surface = glass_color * (1.0 - shadow) * (1.0 - scattered) + tint * scattered;
  return surface;
}

fn button_surface(
  point: vec2f, radius: f32, q: f32, field_uv: vec2f, diffused: vec3f
) -> vec4f {
  let bevel = smoothstep(0.82, 1.0, q);
  let normal = normalize(vec3f(point * mix(0.16, 0.8, bevel), 1.0));
  let reflected = fracture_at(field_uv - normal.xy * 0.012).rgb;
  let facing = max(dot(normal, normalize(vec3f(-0.6, -0.8, 0.9))), 0.0);
  let glint = pow(facing, 12.0) * bevel;
  let shadow_stone = vec3f(0.0006, 0.0009, 0.0016);
  let light_stone = mix(vec3f(1.25, 1.18, 1.0), vec3f(2.3, 2.15, 1.85), bevel);
  let radiance = mix(shadow_stone, light_stone, glass.scheme)
    + reflected * 0.02 + diffused * 0.004
    + mix(vec3f(0.016, 0.017, 0.019), vec3f(0.4, 0.38, 0.32), glass.scheme) * glint;
  let coverage = 1.0 - smoothstep(1.0 - 0.8 / radius, 1.0, q);
  let opacity = mix(0.4, 0.62, bevel);
  return vec4f(film(radiance), coverage * opacity);
}

fn shade_glass(uv: vec2f) -> vec4f {
  let pixel = uv * glass.resolution;
  let origin = glass.tablet_origin;
  let local = pixel - origin;
  let half_size = glass.tablet_size * 0.5;
  let centered = local - half_size;
  let outside = max(abs(centered) - half_size, vec2f(0.0));
  let outside_distance = length(outside);
  var plume = 0.0;
  if (outside_distance > 0.0) {
    let signals = textureSampleLevel(plume_field, plume_sampler, uv, 0.0);
    plume = ink_coverage(uv, signals, ink).x;
    if (outside_distance > max(glass.halo, 1.0) * 4.0 && plume <= 0.001) {
      return vec4f(0.0);
    }
  }
  current = sample_current(centered);
  let field_uv = centered / 640.0;
  let diffused = diffuse_at(field_uv);

  let surface_local = clamp(local, vec2f(0.0), glass.tablet_size);
  let surface_centered = surface_local - half_size;
  let edge_pair = min(surface_local, glass.tablet_size - surface_local);
  let edge_distance = min(edge_pair.x, edge_pair.y);
  let bevel = 1.0 - smoothstep(0.0, max(glass.rim * 0.85, 1.0), edge_distance);
  let edge_normal = normalize(vec2f(
    sign(surface_centered.x) * exp(-edge_pair.x / 5.0),
    sign(surface_centered.y) * exp(-edge_pair.y / 5.0)
  ) + vec2f(0.00001));

  if (outside_distance == 0.0 && edge_distance > glass.rim) {
    // Only the small union of visible controls needs the surface checks.
    if (glass.button_count > 0.0
      && all(local >= glass.button_bounds.xy) && all(local <= glass.button_bounds.zw)) {
      for (var i = 0u; i < min(u32(glass.button_count), 16u); i++) {
        let region = glass.button_regions[i];
        let point = (local - region.xy) / region.zw;
        if (any(abs(point) > vec2f(1.0))) {
          continue;
        }
        let q = length(point);
        if (q >= 1.0) {
          continue;
        }
        let button = button_surface(point, min(region.z, region.w), q, field_uv, diffused);
        let behind = basin_surface(local, edge_distance, edge_normal, field_uv, diffused);
        return vec4f(mix(behind, button.rgb, button.a), 1.0);
      }
    }
    return vec4f(basin_surface(local, edge_distance, edge_normal, field_uv, diffused), 1.0);
  }

  let ripple = vec2f(
    sin(surface_local.y * 0.032 + sin(surface_local.x * 0.015)),
    cos(surface_local.x * 0.029 + sin(surface_local.y * 0.018))
  );
  let refraction = surface_centered / 640.0
    + edge_normal * bevel * 0.022 + ripple * 0.006;

  if (outside_distance > 0.0) {
    let tangent = vec2f(-edge_normal.y, edge_normal.x);
    let first_lean = fracture_lean(refraction, edge_normal, tangent);
    let estimate = refraction - tangent * outside_distance * first_lean / 640.0;
    let lean = fracture_lean(estimate, edge_normal, tangent);
    let jet_uv = refraction - tangent * outside_distance * lean / 640.0;
    let edge_light = emission_at(jet_uv);
    let energy = max(max(edge_light.r, edge_light.g), edge_light.b);
    let mist = water_spill(atmosphere(
      field_uv, emission_energy(mix(refraction, field_uv, 0.35)), diffused, outside_distance
    ), field_uv, edge_normal, plume);
    let center_log = log(max(energy, 0.0001));
    let minus_log = log(max(emission_energy(jet_uv - tangent * 3.0 / 640.0), 0.0001));
    let plus_log = log(max(emission_energy(jet_uv + tangent * 3.0 / 640.0), 0.0001));
    let curvature = (plus_log - 2.0 * center_log + minus_log) / 9.0;
    if (curvature >= -0.001 || energy < 0.015) {
      return mist;
    }
    let gradient = (plus_log - minus_log) / 6.0;
    let axis_offset = -gradient / curvature;
    if (abs(axis_offset) > 18.0) {
      return mist;
    }
    let peak = exp(min(center_log - 0.5 * gradient * gradient / curvature, 2.0));
    let emission = smoothstep(0.04, 0.85, peak);
    let progress = 1.0 - plume;
    if (plume <= 0.001) {
      return mist;
    }
    let core_half_width = mix(0.7, 0.2, progress);
    let filament = 1.0 - smoothstep(
      max(0.0, core_half_width - 0.2), core_half_width + 0.2, abs(axis_offset)
    );
    let light = mix(mix(
      film((edge_light * 0.95 + diffused * 0.05) * 3.4),
      vec3f(1.0, 0.985, 0.94),
      0.75
    ), vec3f(0.002, 0.0025, 0.003), glass.scheme);
    let grain_cell = floor(field_uv * 800.0);
    let grain = fract(sin(dot(grain_cell, vec2f(12.9898, 78.233))) * 43758.5453);
    let density = mix(0.84, 1.0, grain);
    let fade = (1.0 - progress * 0.3) * (1.0 - smoothstep(0.85, 1.0, progress));
    let core_alpha = min(0.98, filament * sqrt(emission) * density * fade * 1.1);

    let wake_profile = exp(-abs(axis_offset) / 1.8) * (1.0 - progress);
    let shimmer = sin(dot(field_uv, vec2f(155.0, 231.0)) + progress * 5.0);
    let bend = tangent * shimmer * wake_profile * 0.008
      + edge_normal * wake_profile * 0.003;
    let through = fracture_at(field_uv + bend).rgb;
    let behind = fracture_at(field_uv).rgb;
    let glint = film(abs(through - behind) * 0.8);
    let broken = smoothstep(0.3, 0.85, 0.5 + shimmer * 0.5);
    let wake_strength = wake_profile * emission * density * broken * fade * 0.1;
    let aura = exp(-abs(axis_offset) / 1.0) * emission * fade * 0.1;
    let wake_alpha = max(max(glint.r, glint.g), glint.b) * wake_strength + aura;
    let wake_color = mix(glint * wake_strength + light * aura,
      vec3f(0.002, 0.0025, 0.003) * wake_alpha, glass.scheme);
    let color = light * core_alpha + wake_color * (1.0 - core_alpha);
    let alpha = core_alpha + wake_alpha * (1.0 - core_alpha);
    return vec4f(color + mist.rgb * (1.0 - alpha), alpha + mist.a * (1.0 - alpha));
  }

  // Fixed rock coordinates: the light moves across the fractures, not the stone.
  let rock_uv = surface_centered / 900.0 + glass.field_offset;
  let fracture = textureSampleLevel(fracture_field, field_sampler, rock_uv, 0.0);
  let grain_field = textureSampleLevel(fog_field, field_sampler, rock_uv * 3.0, 0.0).rg;
  let angle = fracture.a * 3.14159265;
  let facet_direction = vec2f(cos(angle), sin(angle));
  let facet_normal = normalize(vec3f(
    edge_normal * 0.75 + facet_direction * mix(0.3, 0.7, grain_field.r),
    mix(0.35, 0.8, grain_field.g)
  ));
  let light_direction = normalize(vec3f(-0.12, -0.12, 1.0));
  let facing = max(dot(facet_normal, light_direction), 0.0);
  let fracture_strength = max(max(fracture.r, fracture.g), fracture.b);
  let crack = smoothstep(0.035, 0.8, fracture_strength);
  let chipped_lip = 4.0 * crack * (1.0 - crack);
  let grain_cell = floor(surface_local * 1.3);
  let grain = fract(sin(dot(grain_cell, vec2f(127.1, 311.7))) * 43758.5453);
  let polish = smoothstep(0.55, 0.78, grain_field.r);
  let rough_light = facing * mix(0.3, 1.0, grain);
  let shard_glint = pow(facing, 18.0) * polish * pow(bevel, 2.0);
  let shadow_stone = mix(vec3f(0.014, 0.016, 0.021), vec3f(0.065, 0.072, 0.085), rough_light);
  let light_stone = mix(vec3f(1.0, 0.95, 0.80), vec3f(3.2, 3.05, 2.7), rough_light);
  let stone = mix(shadow_stone, light_stone, glass.scheme);
  let reflected = fracture_at(field_uv - facet_normal.xy * 0.025).rgb;
  let transmitted = fracture_at(refraction + facet_direction * 0.004).rgb;
  let radiance = (stone + transmitted * 0.075 + reflected * mix(0.07, 0.22, polish)
    + diffused * 0.035) * (1.0 - crack * mix(0.88, 0.18, glass.scheme))
    + vec3f(0.18, 0.19, 0.22) * (shard_glint + chipped_lip * facing * 0.28);
  return vec4f(film(radiance), 1.0);
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let color = shade_glass(uv);
  if (glass.sdr < 0.5 || color.a <= 0.0) {
    return color;
  }
  // Blend 42% toward sRGB encoding: a dark code value of 1 becomes about 6.
  let linear = max(color.rgb / color.a, vec3f(0.0));
  let display = mix(linear, linearToSrgb3(linear), 0.42);
  return vec4f(display * color.a, color.a);
}
