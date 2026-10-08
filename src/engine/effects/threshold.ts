import { FS_HEAD } from "../core/shaders";
import type { EffectDef } from "./types";

export const threshold: EffectDef<"threshold"> = {
  type: "threshold",
  label: "threshold",
  defaults: { level: 0.5, soft: 0.05 },
  ranges: { level: { min: 0, max: 1 }, soft: { min: 0, max: 0.5 } },
  fragment: FS_HEAD + `
uniform float p_level, p_soft;
void main(){ vec4 t = texture(u_tex, v_uv); float l = dot(t.rgb, vec3(0.299,0.587,0.114)); float m = smoothstep(p_level-p_soft, p_level+p_soft, l); o = vec4(vec3(m), t.a); }`,
};
