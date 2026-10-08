import { FS_HEAD } from "../core/shaders";

// Largest polygon the slice mask shader can hold.
export const MASK_MAX = 64;

// Projective warp: unit square -> quad given by homography in NDC, plus an optional
// mesh displacement. The mesh grid is a cols x rows RGBA32F texture holding NDC offsets;
// it is sampled bicubically (Catmull-Rom), so an all-zero grid is exactly the corner pin.
// The displacement is premultiplied by p.z so the perspective divide leaves it intact and
// v_uv stays perspective-correct.
export const VS_WARP = `#version 300 es
layout(location=0) in vec2 a_uv;
uniform mat3 u_h;
uniform sampler2D u_mesh;
uniform ivec2 u_meshSize;
out vec2 v_uv;
vec2 md(int i, int j){
  i = clamp(i, 0, u_meshSize.x - 1); j = clamp(j, 0, u_meshSize.y - 1);
  return texelFetch(u_mesh, ivec2(i, j), 0).rg;
}
vec2 cr(vec2 p0, vec2 p1, vec2 p2, vec2 p3, float t){
  return 0.5 * (2.0*p1 + (p2 - p0)*t + (2.0*p0 - 5.0*p1 + 4.0*p2 - p3)*t*t + (-p0 + 3.0*p1 - 3.0*p2 + p3)*t*t*t);
}
vec2 meshDisp(vec2 uv){
  float gx = uv.x * float(u_meshSize.x - 1), gy = uv.y * float(u_meshSize.y - 1);
  int i = int(floor(gx)), j = int(floor(gy));
  float tx = gx - float(i), ty = gy - float(j);
  vec2 r0 = cr(md(i-1, j-1), md(i, j-1), md(i+1, j-1), md(i+2, j-1), tx);
  vec2 r1 = cr(md(i-1, j  ), md(i, j  ), md(i+1, j  ), md(i+2, j  ), tx);
  vec2 r2 = cr(md(i-1, j+1), md(i, j+1), md(i+1, j+1), md(i+2, j+1), tx);
  vec2 r3 = cr(md(i-1, j+2), md(i, j+2), md(i+1, j+2), md(i+2, j+2), tx);
  return cr(r0, r1, r2, r3, ty);
}
void main(){
  v_uv = a_uv;
  vec3 p = u_h * vec3(a_uv, 1.0);
  vec2 d = u_meshSize.x > 1 ? meshDisp(a_uv) : vec2(0.0);
  gl_Position = vec4(p.xy + d * p.z, 0.0, p.z);
}`;

// Slice: samples the composite's input rect, applies the polygon mask, edge blend and black level.
// v_uv is slice space with y down; the composite texture is y up, hence the 1 - y.
export const FS_SLICE = FS_HEAD + `
#define MASK_MAX ${MASK_MAX}
uniform vec4 u_rect;   // x y w h normalized on composite, y from the top
uniform vec4 u_bw;     // blend widths left right top bottom (0..1 of slice)
uniform vec4 u_bg;     // blend gammas
uniform float u_black;
uniform float u_gamma; // global blend gamma of the output
uniform int u_maskN;
uniform float u_maskSoft;
uniform vec2 u_mask[MASK_MAX];
float ramp(float x, float w, float g){ if (w <= 0.0) return 1.0; float f = clamp(x / w, 0.0, 1.0); return f < 0.5 ? 0.5*pow(2.0*f, g) : 1.0 - 0.5*pow(2.0*(1.0-f), g); }
// Signed distance to the mask polygon, negative inside (iq).
float maskDist(vec2 p){
  float d = 1e9, s = 1.0;
  for (int i = 0; i < MASK_MAX; i++){
    if (i >= u_maskN) break;
    int j = (i == 0) ? u_maskN - 1 : i - 1;
    vec2 vi = u_mask[i], vj = u_mask[j];
    vec2 e = vj - vi, w = p - vi;
    vec2 b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    d = min(d, dot(b, b));
    bvec3 c = bvec3(p.y >= vi.y, p.y < vj.y, e.x * w.y > e.y * w.x);
    if (all(c) || all(not(c))) s = -s;
  }
  return s * sqrt(d);
}
void main(){
  vec2 uv = vec2(u_rect.x + v_uv.x * u_rect.z, 1.0 - (u_rect.y + v_uv.y * u_rect.w));
  vec3 c = texture(u_tex, uv).rgb;
  float f = ramp(v_uv.x, u_bw.x, u_bg.x) * ramp(1.0-v_uv.x, u_bw.y, u_bg.y) * ramp(v_uv.y, u_bw.z, u_bg.z) * ramp(1.0-v_uv.y, u_bw.w, u_bg.w);
  f = pow(f, u_gamma);
  if (u_maskN >= 3) f *= smoothstep(0.0, 1.0, clamp(-maskDist(v_uv) / max(u_maskSoft, 1e-4), 0.0, 1.0));
  c = c * f;
  c = max(c, vec3(u_black));
  o = vec4(c, 1.0);
}`;
