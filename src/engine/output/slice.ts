import type { Output, Slice } from "../../doc/schema";
import type { Prog } from "../core/gl";
import { squareToQuad } from "./homography";
import { meshActive } from "./mesh";
import { testPatternTexture } from "./testpattern";
import { MASK_MAX } from "./warp";

// Draws every enabled slice of an output: each one warps its input rect of the composite
// onto its four corners (plus the mesh), with polygon mask, edge blend and black level.

const meshTextures = new WeakMap<WebGL2RenderingContext, WebGLTexture>();

// One scratch grid texture, re-uploaded per slice right before its draw.
function meshTexture(gl: WebGL2RenderingContext): WebGLTexture {
  let t = meshTextures.get(gl);
  if (!t) {
    t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    meshTextures.set(gl, t);
  }
  return t;
}

// Doc offsets are in output space (0..1, y down); the shader wants NDC.
function bindMesh(gl: WebGL2RenderingContext, p: Prog, s: Slice) {
  const on = meshActive(s.mesh);
  const cols = on ? s.mesh.cols : 1, rows = on ? s.mesh.rows : 1;
  const data = new Float32Array(cols * rows * 4);
  if (on) {
    for (let k = 0; k < cols * rows; k++) {
      data[k * 4] = s.mesh.offsets[k][0] * 2;
      data[k * 4 + 1] = -s.mesh.offsets[k][1] * 2;
    }
  }
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, meshTexture(gl));
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, cols, rows, 0, gl.RGBA, gl.FLOAT, data);
  gl.uniform1i(p.u.loc("u_mesh"), 1);
  gl.uniform2i(p.u.loc("u_meshSize"), on ? cols : 0, on ? rows : 0);
}

function bindMask(gl: WebGL2RenderingContext, p: Prog, s: Slice) {
  const pts = s.mask.enabled ? s.mask.points.slice(0, MASK_MAX) : [];
  const n = pts.length >= 3 ? pts.length : 0;
  gl.uniform1i(p.u.loc("u_maskN"), n);
  if (n) {
    const flat = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { flat[i * 2] = pts[i][0]; flat[i * 2 + 1] = pts[i][1]; }
    gl.uniform2fv(p.u.loc("u_mask"), flat);
  }
  p.u.f("u_maskSoft", s.mask.softness);
}

export function drawOutput(gl: WebGL2RenderingContext, p: Prog, drawQuad: () => void, composite: WebGLTexture, out: Output, cw: number, ch: number) {
  if (out.blackout) return;
  for (const s of out.slices) {
    if (!s.enabled) continue;
    // corners are normalized window coords with y down; convert to NDC
    const ndc = s.corners.map(([x, y]) => [x * 2 - 1, 1 - y * 2]) as [number, number][];
    p.u.m3("u_h", squareToQuad(ndc));
    p.u.tex("u_tex", 0, out.testPattern ? testPatternTexture(gl, s.name) : composite);
    p.u.v2("u_res", cw, ch);
    const r = out.testPattern ? [0, 0, 1, 1] : s.input;
    p.u.v4("u_rect", r[0], r[1], r[2], r[3]);
    p.u.v4("u_bw", s.blend.left.width, s.blend.right.width, s.blend.top.width, s.blend.bottom.width);
    p.u.v4("u_bg", s.blend.left.gamma, s.blend.right.gamma, s.blend.top.gamma, s.blend.bottom.gamma);
    p.u.f("u_black", s.blackLevel);
    p.u.f("u_gamma", out.blendGamma);
    bindMask(gl, p, s);
    bindMesh(gl, p, s);
    drawQuad();
  }
}
