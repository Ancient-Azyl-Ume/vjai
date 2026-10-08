import { FS_HEAD } from "../core/shaders";
import type { EffectDef } from "./types";

// Chromatic split: red and blue sampled either side of green along `angle`.
export const rgbshift: EffectDef<"rgbshift"> = {
  type: "rgbshift",
  label: "rgb shift",
  defaults: { amount: 6, angle: 0 },
  ranges: { amount: { min: -64, max: 64 }, angle: { min: -3.14159, max: 3.14159 } },
  fragment: FS_HEAD + `
uniform float p_amount, p_angle;
void main(){
  vec2 d = vec2(cos(p_angle), sin(p_angle)) * p_amount / u_res;
  vec4 c = texture(u_tex, v_uv);
  vec4 r = texture(u_tex, v_uv + d);
  vec4 b = texture(u_tex, v_uv - d);
  o = vec4(r.r, c.g, b.b, max(c.a, max(r.a, b.a)));
}`,
};
