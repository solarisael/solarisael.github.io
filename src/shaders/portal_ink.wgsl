import { Ink } from "./portal_ink_types.wgsl";
import { linearToSrgb3 } from "@vgpu/wgsl-std/color";
import { ink_coverage } from "./portal_ink_coverage.wgsl";

@group(0) @binding(0) var<uniform> ink: Ink;
@group(0) @binding(1) var ink_field: texture_2d<f32>;
@group(0) @binding(2) var field_sampler: sampler;

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let signals = textureSampleLevel(ink_field, field_sampler, uv, 0.0);
  let body = signals.z;
  let coverage = ink_coverage(uv, signals, ink);
  let pigment = coverage.x;
  let wet_edge = coverage.y;

  let shadow = vec3f(0.001, 0.0015, 0.0025)
    + vec3f(0.45, 0.55, 0.65) * wet_edge
    + vec3f(0.002, 0.003, 0.004) * clamp(body + 0.5, 0.0, 1.0);
  let radiance = mix(vec3f(0.72, 0.70, 0.63), vec3f(1.0, 0.98, 0.91),
    clamp(body + 0.5 + wet_edge * 12.0, 0.0, 1.0));
  let color = mix(shadow, radiance, ink.scheme);
  // Match the basin's 42% SDR lift before alpha multiplication.
  let display = mix(color, linearToSrgb3(color), ink.sdr * 0.42);
  return vec4f(display * pigment, pigment);
}
