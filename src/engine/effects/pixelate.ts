import { FS_HEAD } from "../core/shaders";
import type { EffectDef } from "./types";

export const pixelate: EffectDef<"pixelate"> = {
  type: "pixelate",
  label: "pixelate",
  defaults: { size: 8 },
  ranges: { size: { min: 1, max: 128 } },
  fragment: FS_HEAD + `
uniform float p_size;
void main(){ float s = max(p_size, 1.0); vec2 uv = (floor(v_uv*u_res/s)+0.5)*s/u_res; o = texture(u_tex, uv); }`,
};
