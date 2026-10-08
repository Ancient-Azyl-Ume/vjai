import { FS_HEAD } from "../core/shaders";
import type { EffectDef } from "./types";

export const posterize: EffectDef<"posterize"> = {
  type: "posterize",
  label: "posterize",
  defaults: { levels: 4, mix: 1 },
  ranges: { levels: { min: 2, max: 32, step: 1 }, mix: { min: 0, max: 1 } },
  fragment: FS_HEAD + `
uniform float p_levels, p_mix;
void main(){
  vec4 t = texture(u_tex, v_uv);
  float n = max(floor(p_levels + 0.5), 2.0);
  vec3 c = clamp(floor(t.rgb * n) / (n - 1.0), 0.0, 1.0);
  o = vec4(mix(t.rgb, c, clamp(p_mix, 0.0, 1.0)), t.a);
}`,
};
