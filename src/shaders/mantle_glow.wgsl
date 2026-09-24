const MAX_GLOWS: u32 = 64u;

struct MantleGlowFrame {
  resolution: vec2f,
  count: f32,
  intensity: f32,
}

struct MantleGlowActor {
  bounds: vec4f,
  uv: vec4f,
  glow: vec4f,
}

@group(0) @binding(0) var<uniform> frame: MantleGlowFrame;
@group(0) @binding(1) var<storage, read> actors: array<MantleGlowActor>;
@group(0) @binding(2) var ornament_atlas: texture_2d<f32>;
@group(0) @binding(3) var ornament_sampler: sampler;

fn source_uv(screen_uv: vec2f, transform: u32) -> vec2f {
  if (transform == 1u) {
    return vec2f(1.0 - screen_uv.x, screen_uv.y);
  }
  if (transform == 2u) {
    return vec2f(screen_uv.x, 1.0 - screen_uv.y);
  }
  if (transform == 3u) {
    return vec2f(1.0 - screen_uv.x, 1.0 - screen_uv.y);
  }
  if (transform == 4u) {
    return vec2f(screen_uv.y, 1.0 - screen_uv.x);
  }
  if (transform == 5u) {
    return vec2f(1.0 - screen_uv.y, screen_uv.x);
  }

  return screen_uv;
}

fn shape_mask(pixels: vec2f, actor: MantleGlowActor) -> f32 {
  let half_size = actor.bounds.zw * 0.5;
  let screen_uv = (pixels - (actor.bounds.xy - half_size))
    / max(actor.bounds.zw, vec2f(1.0));
  let inside = step(vec2f(0.0), screen_uv) * step(screen_uv, vec2f(1.0));
  let inside_mask = inside.x * inside.y;
  let transformed = source_uv(screen_uv, u32(actor.glow.z + 0.5));
  let atlas_uv = mix(actor.uv.xy, actor.uv.zw, clamp(transformed, vec2f(0.0), vec2f(1.0)));

  return textureSampleLevel(
    ornament_atlas,
    ornament_sampler,
    atlas_uv,
    0.0
  ).a * inside_mask * actor.glow.y;
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let pixels = uv * frame.resolution;
  let actor_count = min(u32(frame.count), MAX_GLOWS);
  var mask = 0.0;

  for (var index = 0u; index < MAX_GLOWS; index += 1u) {
    if (index >= actor_count) {
      break;
    }

    let actor = actors[index];
    let half_size = actor.bounds.zw * 0.5;
    let delta = abs(pixels - actor.bounds.xy);
    if (delta.x <= half_size.x && delta.y <= half_size.y) {
      mask = max(mask, shape_mask(pixels, actor));
    }
  }

  return vec4f(mask);
}
