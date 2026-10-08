import type { Fbo } from "../core/gl";
import { FS_HEAD, VS_QUAD } from "../core/shaders";
import { MaskTypes, type Layer } from "../../doc/schema";
import type { SourceCtx } from "./types";

// Layer mask. Runs after the effect chain, just before the layer is blended, so
// "luma"/"alpha" can read the stack below it (u_base = the composite so far).
// The pass only touches alpha; the composite blend already multiplies by it.

const FS_MASK =
  FS_HEAD +
  `
uniform sampler2D u_base;
uniform int u_kind;      // index into MaskTypes
uniform float u_invert;
uniform vec2 u_c;        // shape centre in canvas uv
uniform vec2 u_s;        // shape size in canvas uv
uniform float u_soft;
void main(){
  vec4 t = texture(u_tex, v_uv);
  float m = 1.0;
  if (u_kind == 1) {
    m = dot(texture(u_base, v_uv).rgb, vec3(0.299, 0.587, 0.114));
  } else if (u_kind == 2) {
    m = texture(u_base, v_uv).a;
  } else if (u_kind == 3) {
    vec2 d = abs(v_uv - u_c) - u_s * 0.5;
    m = 1.0 - smoothstep(-u_soft, u_soft, max(d.x, d.y));
  } else if (u_kind == 4) {
    vec2 p = (v_uv - u_c) / max(u_s * 0.5, vec2(1e-4));
    m = 1.0 - smoothstep(1.0 - u_soft, 1.0 + u_soft, length(p));
  }
  m = clamp(mix(m, 1.0 - m, u_invert), 0.0, 1.0);
  o = vec4(t.rgb, t.a * m);
}`;

// Subset of SourceCtx the pass needs; the engine already has all four.
export type MaskPass = Pick<SourceCtx, "use" | "target" | "drawQuad" | "param">;

// Returns the masked texture, or `tex` unchanged when the layer has no mask.
// `out` must be a free canvas-sized FBO (the engine hands it the idle half of its ping-pong).
export function applyMask(
  pass: MaskPass,
  layer: Layer,
  tex: WebGLTexture,
  baseTex: WebGLTexture,
  out: Fbo,
): WebGLTexture {
  const m = layer.mask;
  const kind = m ? MaskTypes.indexOf(m.type) : 0;
  if (kind <= 0) return tex;
  const base = `layers.${layer.id}.mask`;
  pass.target(out);
  const p = pass.use("layer:mask", VS_QUAD, FS_MASK);
  p.u.tex("u_tex", 0, tex);
  p.u.tex("u_base", 1, baseTex);
  p.u.v2("u_res", out.w, out.h);
  p.u.i("u_kind", kind);
  p.u.f("u_invert", m.invert ? 1 : 0);
  p.u.v2("u_c", pass.param(`${base}.x`, m.x), pass.param(`${base}.y`, m.y));
  p.u.v2("u_s", pass.param(`${base}.w`, m.w), pass.param(`${base}.h`, m.h));
  p.u.f("u_soft", Math.max(1e-4, pass.param(`${base}.softness`, m.softness)));
  pass.drawQuad();
  return out.tex;
}
