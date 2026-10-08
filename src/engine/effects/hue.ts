import { FS_HEAD } from "../core/shaders";
import type { EffectDef } from "./types";

export const hue: EffectDef<"hue"> = {
  type: "hue",
  label: "hue / saturation",
  defaults: { shift: 0, saturation: 1 },
  ranges: { shift: { min: 0, max: 1 }, saturation: { min: 0, max: 3 } },
  fragment: FS_HEAD + `
uniform float p_shift, p_saturation;
vec3 rgb2hsv(vec3 c){ vec4 K=vec4(0.,-1./3.,2./3.,-1.); vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g)); vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r)); float d=q.x-min(q.w,q.y); float e=1e-10; return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x); }
vec3 hsv2rgb(vec3 c){ vec4 K=vec4(1.,2./3.,1./3.,3.); vec3 p=abs(fract(c.xxx+K.xyz)*6.-K.www); return c.z*mix(K.xxx,clamp(p-K.xxx,0.,1.),c.y); }
void main(){ vec4 t = texture(u_tex, v_uv); vec3 h = rgb2hsv(t.rgb); h.x = fract(h.x + p_shift); h.y *= p_saturation; o = vec4(hsv2rgb(h), t.a); }`,
};
