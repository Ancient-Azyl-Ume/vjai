import { FS_HEAD } from "../core/shaders";
import type { EffectDef } from "./types";

export const vignette: EffectDef<"vignette"> = {
  type: "vignette",
  label: "vignette",
  defaults: { amount: 1, radius: 0.55, softness: 0.45 },
  ranges: { amount: { min: 0, max: 1 }, radius: { min: 0, max: 1.5 }, softness: { min: 0.01, max: 1 } },
  fragment: FS_HEAD + `
uniform float p_amount, p_radius, p_softness;
void main(){
  vec4 t = texture(u_tex, v_uv);
  float ar = u_res.x / max(u_res.y, 1.0);
  vec2 p = (v_uv - 0.5) * vec2(ar, 1.0);
  float d = length(p) / (0.5 * length(vec2(ar, 1.0)));
  float v = 1.0 - smoothstep(p_radius, p_radius + max(p_softness, 0.001), d) * clamp(p_amount, 0.0, 1.0);
  o = vec4(t.rgb * v, t.a);
}`,
};
