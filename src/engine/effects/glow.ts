import { FS_HEAD } from "../core/shaders";
import type { EffectDef } from "./types";

// Bloom in one pass: threshold the input, blur the bright part over three rings, add it back.
export const glow: EffectDef<"glow"> = {
  type: "glow",
  label: "glow / bloom",
  defaults: { threshold: 0.6, radius: 12, intensity: 1.2, knee: 0.2 },
  ranges: {
    threshold: { min: 0, max: 1 },
    radius: { min: 0, max: 128 },
    intensity: { min: 0, max: 4 },
    knee: { min: 0.01, max: 1 },
  },
  fragment: FS_HEAD + `
uniform float p_threshold, p_radius, p_intensity, p_knee;
vec3 bright(vec2 uv){
  vec3 c = texture(u_tex, uv).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  return c * smoothstep(p_threshold, p_threshold + max(p_knee, 0.01), l);
}
void main(){
  vec2 px = p_radius / u_res;
  vec3 sum = bright(v_uv) * 2.0;
  float wsum = 2.0;
  for (int r = 0; r < 3; r++) {
    float rad = 0.4 + float(r) * 0.3;
    float w = 1.0 - float(r) * 0.25;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.7853982 + float(r) * 0.2617994;
      sum += bright(v_uv + vec2(cos(a), sin(a)) * px * rad) * w;
      wsum += w;
    }
  }
  vec4 t = texture(u_tex, v_uv);
  o = vec4(t.rgb + (sum / wsum) * p_intensity, t.a);
}`,
};
