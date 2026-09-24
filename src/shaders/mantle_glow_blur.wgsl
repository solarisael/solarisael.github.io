import { linearToSrgb3 } from "@vgpu/wgsl-std/color";

struct MantleGlowBlur {
  direction: vec2f,
  radius: f32,
  intensity: f32,
  colorize: f32,
}

@group(0) @binding(0) var<uniform> blur: MantleGlowBlur;
@group(0) @binding(1) var source_texture: texture_2d<f32>;
@group(0) @binding(2) var source_sampler: sampler;

fn source_alpha(uv: vec2f) -> f32 {
  return textureSampleLevel(source_texture, source_sampler, uv, 0.0).a;
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let dimensions = vec2f(textureDimensions(source_texture));
  let step_uv = blur.direction * blur.radius / max(dimensions, vec2f(1.0));
  var alpha = source_alpha(uv) * 0.227027;

  alpha += source_alpha(uv + step_uv * 1.0) * 0.1945946;
  alpha += source_alpha(uv - step_uv * 1.0) * 0.1945946;
  alpha += source_alpha(uv + step_uv * 2.0) * 0.1216216;
  alpha += source_alpha(uv - step_uv * 2.0) * 0.1216216;
  alpha += source_alpha(uv + step_uv * 3.0) * 0.054054;
  alpha += source_alpha(uv - step_uv * 3.0) * 0.054054;
  alpha += source_alpha(uv + step_uv * 4.0) * 0.016216;
  alpha += source_alpha(uv - step_uv * 4.0) * 0.016216;

  if (blur.colorize < 0.5) {
    return vec4f(alpha);
  }

  alpha = clamp(alpha * 1.12 * blur.intensity, 0.0, 0.48);
  let gold_linear = vec3f(0.5776, 0.3968, 0.1470);
  let gold_display = linearToSrgb3(gold_linear);

  return vec4f(gold_display * alpha, alpha);
}
