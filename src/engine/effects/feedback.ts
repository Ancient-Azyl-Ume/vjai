import { FS_HEAD } from "../core/shaders";
import type { EffectDef } from "./types";

export const feedback: EffectDef<"feedback"> = {
  type: "feedback",
  label: "feedback",
  defaults: { amount: 0.85, zoom: 1.01, rotate: 0 },
  ranges: { amount: { min: 0, max: 1 }, zoom: { min: 0.9, max: 1.1 }, rotate: { min: -0.2, max: 0.2 } },
  needsFeedback: true,
  fragment: FS_HEAD + `
uniform sampler2D u_prev; uniform float p_amount, p_zoom, p_rotate;
void main(){
  vec2 uv = v_uv - 0.5; float a = p_rotate; mat2 r = mat2(cos(a), -sin(a), sin(a), cos(a));
  uv = r * uv / max(p_zoom, 0.001) + 0.5;
  vec4 cur = texture(u_tex, v_uv); vec4 prev = texture(u_prev, uv);
  o = vec4(max(cur.rgb, prev.rgb * p_amount), max(cur.a, prev.a * p_amount));
}`,
};
