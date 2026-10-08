import { FS_HEAD } from "../core/shaders";
import type { EffectDef } from "./types";

// Gradient map: luminance picks between two colours. Colours are six floats because
// effect params are numbers.
export const colorize: EffectDef<"colorize"> = {
  type: "colorize",
  label: "colorize",
  defaults: { darkR: 0.05, darkG: 0, darkB: 0.25, lightR: 1, lightG: 0.35, lightB: 0.1, mix: 1 },
  ranges: {
    darkR: { min: 0, max: 1 },
    darkG: { min: 0, max: 1 },
    darkB: { min: 0, max: 1 },
    lightR: { min: 0, max: 1 },
    lightG: { min: 0, max: 1 },
    lightB: { min: 0, max: 1 },
    mix: { min: 0, max: 1 },
  },
  fragment: FS_HEAD + `
uniform float p_darkR, p_darkG, p_darkB, p_lightR, p_lightG, p_lightB, p_mix;
void main(){
  vec4 t = texture(u_tex, v_uv);
  float l = dot(t.rgb, vec3(0.299, 0.587, 0.114));
  vec3 c = mix(vec3(p_darkR, p_darkG, p_darkB), vec3(p_lightR, p_lightG, p_lightB), l);
  o = vec4(mix(t.rgb, c, clamp(p_mix, 0.0, 1.0)), t.a);
}`,
};
