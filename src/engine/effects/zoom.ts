import { FS_HEAD } from "../core/shaders";
import type { EffectDef } from "./types";

export const zoom: EffectDef<"zoom"> = {
  type: "zoom",
  label: "zoom",
  defaults: { amount: 1, rotate: 0 },
  ranges: { amount: { min: 0.1, max: 4 }, rotate: { min: -3.14, max: 3.14 } },
  fragment: FS_HEAD + `
uniform float p_amount, p_rotate;
void main(){
  vec2 uv = v_uv - 0.5; float a = p_rotate; mat2 r = mat2(cos(a), -sin(a), sin(a), cos(a));
  uv = r * uv / max(p_amount, 0.001) + 0.5;
  o = texture(u_tex, uv);
}`,
};
