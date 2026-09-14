import { simplex3d, fbmSimplex3d } from "@vgpu/wgsl-std/noise/simplex";
import { Ink } from "./portal_ink_types.wgsl";

@group(0) @binding(0) var<uniform> ink: Ink;

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let aspect = ink.resolution.x / max(ink.resolution.y, 1.0);
  let p = (uv - ink.center) * vec2f(aspect, 1.0);
  let drift = ink.time * 0.07;

  let current = vec2f(
    fbmSimplex3d(vec3f(p * 1.65, drift), 3, 2.0, 0.5),
    fbmSimplex3d(vec3f(p * 1.65 + vec2f(13.7, 8.2), drift + 4.3), 3, 2.0, 0.5)
  );
  let warped = p + current * 0.12 * min(aspect, 1.0);
  let body = fbmSimplex3d(vec3f(warped * 3.4 + current * 0.8, drift * 0.6), 3, 2.0, 0.5);
  let eddies = simplex3d(vec3f(warped * 8.0 + current * 2.2, drift * 0.45));

  return vec4f(current, body, eddies);
}
