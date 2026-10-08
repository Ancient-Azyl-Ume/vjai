import { FS_HEAD } from "../core/shaders";
import type { EffectDef } from "./types";

export const tile: EffectDef<"tile"> = {
  type: "tile",
  label: "tile",
  defaults: { repeatX: 2, repeatY: 2, offsetX: 0, offsetY: 0, mirror: 1 },
  ranges: {
    repeatX: { min: 0.1, max: 16 },
    repeatY: { min: 0.1, max: 16 },
    offsetX: { min: -1, max: 1 },
    offsetY: { min: -1, max: 1 },
    mirror: { min: 0, max: 1, step: 1 },
  },
  fragment: FS_HEAD + `
uniform float p_repeatX, p_repeatY, p_offsetX, p_offsetY, p_mirror;
void main(){
  vec2 uv = v_uv * vec2(max(p_repeatX, 0.001), max(p_repeatY, 0.001)) + vec2(p_offsetX, p_offsetY);
  vec2 f = fract(uv);
  if (p_mirror > 0.5) f = mix(f, 1.0 - f, mod(floor(uv), 2.0));
  o = texture(u_tex, f);
}`,
};
