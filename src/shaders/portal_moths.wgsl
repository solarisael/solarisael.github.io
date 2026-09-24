struct Scene {
  resolution: vec2f,
  offset: vec2f,
  time: f32,
  scheme: f32,
  visible: f32,
  depth_count: f32,
  rim: vec4f,
  rim_light: f32,
  root_size: f32,
  depth_regions: array<vec4f, 16>,
  depth_params: array<vec4f, 16>,
}
struct Water { absorption: f32, near_depth: f32, far_depth: f32, wave_depth: f32 }
struct AtlasEntry { uv: vec4f, bounds: vec4f, metrics: vec4f }
// place: rest x and y as canvas fractions, rank, water column depth
// glyph: first atlas entry, entry count, seed, cycle phase
// motion: cycle seconds, drift x and y in rem, turn in radians
// look: resting light, softness in pixels, kind (0 moth, 1 rim mote), unused
struct Moth { place: vec4f, glyph: vec4f, motion: vec4f, look: vec4f }
struct Palette { ink: vec3f, halo: vec3f, halo_alpha: f32, wide: vec3f, wide_alpha: f32 }
@group(0) @binding(0) var<uniform> scene: Scene;
@group(0) @binding(1) var<uniform> water: Water;
@group(0) @binding(2) var<storage, read> moths: array<Moth>;
@group(0) @binding(3) var<storage, read> entries: array<AtlasEntry>;
@group(0) @binding(4) var glyph_texture: texture_2d<f32>;
@group(0) @binding(5) var glyph_sampler: sampler;

const MOTE = 1.0;

fn hash(value: u32) -> u32 {
  var x = value;
  x = (x ^ (x >> 16u)) * 0x7feb352du;
  x = (x ^ (x >> 15u)) * 0x846ca68bu;
  return x ^ (x >> 16u);
}
fn random(value: u32) -> f32 { return f32(hash(value) & 0x00ffffffu) / 16777216.0; }
fn ease(t: f32) -> f32 { return t * t * (3.0 - 2.0 * t); }
fn segment(t: f32, start: f32, end: f32) -> f32 {
  return ease(clamp((t - start) / (end - start), 0.0, 1.0));
}
// The moth opacity keyframes: 0, .65, 1, .45, 0 at 0, 25, 55, 80, 100 percent.
fn glow(t: f32) -> f32 {
  if (t < 0.25) { return mix(0.0, 0.65, segment(t, 0.0, 0.25)); }
  if (t < 0.55) { return mix(0.65, 1.0, segment(t, 0.25, 0.55)); }
  if (t < 0.8) { return mix(1.0, 0.45, segment(t, 0.55, 0.8)); }
  return mix(0.45, 0.0, segment(t, 0.8, 1.0));
}
// The moth transform keyframes: rest at 0 and 100 percent, full drift at 55.
fn travel(t: f32) -> f32 {
  if (t < 0.55) { return segment(t, 0.0, 0.55); }
  return 1.0 - segment(t, 0.55, 1.0);
}
// The mote keyframes, shared with the word particles in portal_lettering.wgsl.
fn trail_alpha(t: f32) -> f32 {
  if (t < 0.12) { return t / 0.12; }
  if (t < 0.7) { return 1.0; }
  if (t < 0.88) { return mix(1.0, 0.65, (t - 0.7) / 0.18); }
  return 0.65 * (1.0 - t) / 0.12;
}
fn trail_travel(t: f32) -> f32 {
  return select(t / 0.7 * 0.75, 0.75 + (t - 0.7) / 0.3 * 0.25, t > 0.7);
}
fn trail_scale(t: f32) -> f32 {
  return select(mix(0.85, 1.0, t / 0.7), mix(1.0, 0.85, (t - 0.7) / 0.3), t > 0.7);
}
fn rotate(point: vec2f, angle: f32) -> vec2f {
  let c = cos(angle);
  let s = sin(angle);
  return vec2f(point.x * c - point.y * s, point.x * s + point.y * c);
}
// Same basin as obsidian_glass.wgsl and element_depth.js: positive z sinks into a
// depth region, xy is the tablet-local gradient. Regions arrive in tablet space.
fn sample_depression(local: vec2f) -> vec3f {
  var depression = vec3f(0.0);
  for (var i = 0u; i < min(u32(scene.depth_count), 16u); i++) {
    let region = scene.depth_regions[i];
    let params = scene.depth_params[i];
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
// Light: the DOM colors these replaced. Dark: ink over a faint pale halo that
// stands in for the old 1px emboss.
fn palette(kind: f32, scheme: f32) -> Palette {
  var p: Palette;
  if (kind == MOTE) {
    p.ink = mix(vec3f(1.0, 0.816, 0.424), vec3f(0.090, 0.098, 0.106), scheme);
    p.halo = mix(vec3f(1.0, 0.863, 0.525), vec3f(1.0, 0.992, 0.953), scheme);
    p.halo_alpha = mix(0.75, 0.3, scheme);
    p.wide = vec3f(1.0, 0.714, 0.208);
    p.wide_alpha = mix(0.5, 0.0, scheme);
  } else {
    p.ink = mix(vec3f(0.929, 0.875, 0.722), vec3f(0.157, 0.169, 0.180), scheme);
    p.halo = mix(vec3f(0.957, 0.871, 0.718), vec3f(1.0, 0.992, 0.953), scheme);
    p.halo_alpha = mix(0.48, 0.3, scheme);
    p.wide = vec3f(0.835, 0.714, 0.404);
    p.wide_alpha = mix(0.25, 0.0, scheme);
  }
  return p;
}
struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) effect: vec3f,
}
@vertex fn vs_main(@builtin(vertex_index) vertex: u32, @builtin(instance_index) instance: u32) -> VertexOut {
  let moth = moths[instance];
  var out: VertexOut;
  out.position = vec4f(2.0, 2.0, 0.0, 1.0);
  if (moth.place.z >= scene.visible) { return out; }

  let clock = scene.time / moth.motion.x + moth.glyph.w;
  let cycle = u32(floor(clock));
  let t = fract(clock);
  let key = u32(moth.glyph.z) + cycle * 7919u;
  let entry = entries[u32(moth.glyph.x) + hash(key) % u32(moth.glyph.y)];
  let kind = moth.look.z;
  var center: vec2f;
  var scale: f32;
  var angle: f32;
  var opacity: f32;
  var softness = moth.look.y;

  if (kind == MOTE) {
    // Born on the close rim, drifts outward, renewed every cycle from the key.
    let heading = random(key + 1u) * 6.2831853;
    let direction = vec2f(cos(heading), sin(heading));
    let distance = (1.0 + random(key + 2u) * 0.8) * scene.root_size;
    let path = trail_travel(t);
    center = scene.rim.xy + direction * scene.rim.zw + direction * distance * path;
    scale = trail_scale(t);
    angle = (random(key + 3u) - 0.5) * 1.134464 * path;
    opacity = trail_alpha(t) * scene.rim_light;
  } else {
    let path = travel(t);
    let drift = moth.motion.yz * scene.root_size;
    center = moth.place.xy * scene.resolution + drift * path;
    scale = mix(0.55, 1.0, path);
    angle = mix(-moth.motion.w, moth.motion.w, path);
    opacity = moth.look.x * glow(t);
  }

  let depression = sample_depression(center + scene.offset);
  let depth = depression.z;
  center += vec2f(-depression.x * 6.0, depth * 0.42 - depression.y * 6.0);
  scale /= 1.0 + depth / 72.0;
  softness += depth * 0.015;
  opacity *= exp(-water.absorption * (moth.place.w + depth));

  let corners = array<vec2f, 6>(vec2f(0, 0), vec2f(1, 0), vec2f(0, 1), vec2f(0, 1), vec2f(1, 0), vec2f(1, 1));
  let corner = corners[vertex];
  let origin = center + vec2f(-entry.metrics.x * 0.5, (entry.metrics.y - entry.metrics.z) * 0.5);
  let point = origin + entry.bounds.xy + corner * entry.bounds.zw;
  let pixel = center + rotate((point - center) * scale, angle);
  out.position = vec4f(pixel.x / scene.resolution.x * 2.0 - 1.0, 1.0 - pixel.y / scene.resolution.y * 2.0, 0.0, 1.0);
  out.uv = mix(entry.uv.xy, entry.uv.zw, corner);
  out.effect = vec3f(opacity, softness, kind);
  return out;
}

@fragment fn fs_main(input: VertexOut) -> @location(0) vec4f {
  let masks = textureSampleLevel(glyph_texture, glyph_sampler, input.uv, 0.0);
  let opacity = input.effect.x;
  let p = palette(input.effect.z, scene.scheme);
  // ponytail: softness leans the crisp mask toward the small glow, not a true
  // blur; upgrade when a far moth reads sharp against the near ones.
  let soft = clamp(input.effect.y / 3.0, 0.0, 1.0);
  let body = mix(masks.r, masks.g, soft);
  let halo_alpha = masks.g * p.halo_alpha;
  let wide_alpha = masks.b * p.wide_alpha;
  var color = p.wide * wide_alpha;
  var alpha = wide_alpha;
  color = p.halo * halo_alpha + color * (1.0 - halo_alpha);
  alpha = halo_alpha + alpha * (1.0 - halo_alpha);
  color = p.ink * body + color * (1.0 - body);
  alpha = body + alpha * (1.0 - body);
  return vec4f(color, alpha) * opacity;
}
