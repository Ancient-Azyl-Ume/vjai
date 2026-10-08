import { FS_HEAD } from "../core/shaders";
import type { EffectDef } from "./types";

// Sobel edge detect on luminance, mixed back over the source.
export const edge: EffectDef<"edge"> = {
  type: "edge",
  label: "edge (sobel)",
  defaults: { mix: 1, strength: 1.5, width: 1 },
  ranges: { mix: { min: 0, max: 1 }, strength: { min: 0, max: 8 }, width: { min: 0.25, max: 8 } },
  fragment: FS_HEAD + `
uniform float p_mix, p_strength, p_width;
float lum(vec2 uv){ return dot(texture(u_tex, uv).rgb, vec3(0.299, 0.587, 0.114)); }
void main(){
  vec2 px = max(p_width, 0.01) / u_res;
  float tl = lum(v_uv + vec2(-1.0, -1.0) * px);
  float tm = lum(v_uv + vec2( 0.0, -1.0) * px);
  float tr = lum(v_uv + vec2( 1.0, -1.0) * px);
  float ml = lum(v_uv + vec2(-1.0,  0.0) * px);
  float mr = lum(v_uv + vec2( 1.0,  0.0) * px);
  float bl = lum(v_uv + vec2(-1.0,  1.0) * px);
  float bm = lum(v_uv + vec2( 0.0,  1.0) * px);
  float br = lum(v_uv + vec2( 1.0,  1.0) * px);
  float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
  float gy = -tl - 2.0 * tm - tr + bl + 2.0 * bm + br;
  float g = clamp(length(vec2(gx, gy)) * p_strength, 0.0, 1.0);
  vec4 t = texture(u_tex, v_uv);
  o = vec4(mix(t.rgb, vec3(g), clamp(p_mix, 0.0, 1.0)), t.a);
}`,
};
