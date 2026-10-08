import { FS_HEAD } from "../core/shaders";
import type { EffectDef } from "./types";

export const levels: EffectDef<"levels"> = {
  type: "levels",
  label: "levels",
  defaults: { black: 0, white: 1, gamma: 1 },
  ranges: { black: { min: 0, max: 1 }, white: { min: 0, max: 1 }, gamma: { min: 0.1, max: 4 } },
  fragment: FS_HEAD + `
uniform float p_black, p_white, p_gamma;
void main(){
  vec4 t = texture(u_tex, v_uv);
  vec3 c = clamp((t.rgb - p_black) / max(p_white - p_black, 0.001), 0.0, 1.0);
  c = pow(c, vec3(1.0 / max(p_gamma, 0.001)));
  o = vec4(c, t.a);
}`,
};
