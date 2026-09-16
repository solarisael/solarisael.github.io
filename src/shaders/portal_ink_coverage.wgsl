import { Ink } from "./portal_ink_types.wgsl";

export fn ink_coverage(uv: vec2f, signals: vec4f, ink: Ink) -> vec2f {
  let aspect = ink.resolution.x / max(ink.resolution.y, 1.0);
  let p = (uv - ink.center) * vec2f(aspect, 1.0);
  let warped = p + signals.xy * 0.12 * min(aspect, 1.0);
  let normalized = abs(warped / max(ink.extent, vec2f(0.001)));
  let radius = pow(pow(normalized.x, 3.0) + pow(normalized.y, 3.0), 1.0 / 3.0);
  let spread = mix(0.015, 1.0, smoothstep(0.0, 1.0, ink.reveal));
  let edge = radius - spread + signals.z * 0.18 + signals.w * 0.035;
  let dense = 1.0 - smoothstep(-0.035, 0.035, edge);
  let wash = 1.0 - smoothstep(-0.015, 0.20, edge + signals.z * 0.05);
  let pigment = clamp(dense * 0.98 + wash * 0.22, 0.0, 0.995);
  let wet_edge = max(wash - dense, 0.0) * 0.012;
  return vec2f(pigment, wet_edge);
}
