import { FS_HEAD } from "../core/shaders";
import type { EffectDef } from "./types";

// Keys out one colour and writes the result into alpha, so the layer blend drops it.
// The key colour is three floats (r/g/b) because effect params are numbers.
export const chromakey: EffectDef<"chromakey"> = {
  type: "chromakey",
  label: "chroma key",
  defaults: { r: 0, g: 1, b: 0, tolerance: 0.3, softness: 0.12, despill: 0.5 },
  ranges: {
    r: { min: 0, max: 1 },
    g: { min: 0, max: 1 },
    b: { min: 0, max: 1 },
    tolerance: { min: 0, max: 1.5 },
    softness: { min: 0.001, max: 0.6 },
    despill: { min: 0, max: 1 },
  },
  fragment: FS_HEAD + `
uniform float p_r, p_g, p_b, p_tolerance, p_softness, p_despill;
const vec3 L = vec3(0.299, 0.587, 0.114);
vec3 chroma(vec3 c){ return c - vec3(dot(c, L)); }
void main(){
  vec4 t = texture(u_tex, v_uv);
  vec3 key = vec3(p_r, p_g, p_b);
  float d = distance(chroma(t.rgb), chroma(key));
  float a = smoothstep(p_tolerance, p_tolerance + max(p_softness, 0.001), d);
  vec3 c = mix(t.rgb, vec3(dot(t.rgb, L)), (1.0 - a) * p_despill);
  o = vec4(c, t.a * a);
}`,
};
