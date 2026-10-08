import { FS_HEAD } from "../core/shaders";
import type { EffectDef } from "./types";

export const invert: EffectDef<"invert"> = {
  type: "invert",
  label: "invert",
  defaults: { amount: 1 },
  ranges: { amount: { min: 0, max: 1 } },
  fragment: FS_HEAD + `uniform float p_amount; void main(){ vec4 t = texture(u_tex, v_uv); o = vec4(mix(t.rgb, 1.0-t.rgb, p_amount), t.a); }`,
};
