import { FS_HEAD } from "../core/shaders";
import type { EffectDef } from "./types";

// Cheap single-pass gaussian approximation: 13 taps on two rings plus the centre.
export const blur: EffectDef<"blur"> = {
  type: "blur",
  label: "blur",
  defaults: { radius: 6, mix: 1 },
  ranges: { radius: { min: 0, max: 64 }, mix: { min: 0, max: 1 } },
  fragment: FS_HEAD + `
uniform float p_radius, p_mix;
void main(){
  vec2 px = p_radius / u_res;
  vec4 sum = texture(u_tex, v_uv) * 3.0;
  float wsum = 3.0;
  for (int i = 0; i < 6; i++) {
    float a = float(i) * 1.0471976;
    sum += texture(u_tex, v_uv + vec2(cos(a), sin(a)) * px * 0.5) * 2.0;
    wsum += 2.0;
    float b = a + 0.5235988;
    sum += texture(u_tex, v_uv + vec2(cos(b), sin(b)) * px);
    wsum += 1.0;
  }
  o = mix(texture(u_tex, v_uv), sum / wsum, clamp(p_mix, 0.0, 1.0));
}`,
};
