import { FS_HEAD } from "../core/shaders";
import type { EffectDef } from "./types";

export const kaleido: EffectDef<"kaleido"> = {
  type: "kaleido",
  label: "kaleidoscope",
  defaults: { segments: 6, rotate: 0 },
  ranges: { segments: { min: 1, max: 24 }, rotate: { min: -3.14, max: 3.14 } },
  fragment: FS_HEAD + `
uniform float p_segments, p_rotate;
void main(){
  float ar = u_res.x/u_res.y; vec2 p = (v_uv-0.5)*vec2(ar,1.0);
  float r = length(p); float a = atan(p.y, p.x) + p_rotate;
  float seg = 6.2831853 / max(p_segments, 1.0);
  a = mod(a, seg); a = abs(a - seg*0.5);
  vec2 q = vec2(cos(a), sin(a)) * r; q.x /= ar;
  o = texture(u_tex, q + 0.5);
}`,
};
