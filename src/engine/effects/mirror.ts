import { FS_HEAD } from "../core/shaders";
import type { EffectDef } from "./types";

// mode: 0 off, 1 mirror x, 2 mirror y, 3 quad. `offset` moves the mirror line.
export const mirror: EffectDef<"mirror"> = {
  type: "mirror",
  label: "mirror",
  defaults: { mode: 3, offset: 0, flip: 0 },
  ranges: { mode: { min: 0, max: 3, step: 1 }, offset: { min: -0.5, max: 0.5 }, flip: { min: 0, max: 1, step: 1 } },
  fragment: FS_HEAD + `
uniform float p_mode, p_offset, p_flip;
void main(){
  int m = int(p_mode + 0.5);
  float c = 0.5 + p_offset;
  vec2 uv = v_uv;
  if (p_flip > 0.5) uv = 1.0 - uv;
  if (m == 1 || m == 3) uv.x = c - abs(uv.x - c);
  if (m == 2 || m == 3) uv.y = c - abs(uv.y - c);
  o = texture(u_tex, clamp(uv, 0.0, 1.0));
}`,
};
