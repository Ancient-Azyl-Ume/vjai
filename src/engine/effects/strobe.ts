import { FS_HEAD } from "../core/shaders";
import type { EffectDef } from "./types";

// Time-based on/off gate. rate in Hz, duty 0..1 of the cycle lit, phase offsets the cycle,
// dark is what the off part is multiplied by (0 = full black).
export const strobe: EffectDef<"strobe"> = {
  type: "strobe",
  label: "strobe",
  defaults: { rate: 4, duty: 0.5, phase: 0, dark: 0 },
  ranges: {
    rate: { min: 0, max: 30 },
    duty: { min: 0, max: 1 },
    phase: { min: 0, max: 1 },
    dark: { min: 0, max: 1 },
  },
  fragment: FS_HEAD + `
uniform float p_rate, p_duty, p_phase, p_dark;
void main(){
  vec4 t = texture(u_tex, v_uv);
  float ph = fract(u_time * p_rate + p_phase);
  float on = step(ph, clamp(p_duty, 0.0, 1.0));
  o = vec4(t.rgb * mix(clamp(p_dark, 0.0, 1.0), 1.0, on), t.a);
}`,
};
