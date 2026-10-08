import { deleteFbo, ensureFbo, type Fbo } from "../core/gl";
import { FS_HEAD, VS_QUAD } from "../core/shaders";
import type { SourceCtx, SourceInstance } from "./types";

// Per-layer transform pass. Every source instance is wrapped in this (see sources/index.ts),
// so the picture the effect chain sees is already positioned, scaled, rotated and flipped.
// Pixels outside the transformed quad get alpha 0, which the composite blend honours.

const FS_TRANSFORM =
  FS_HEAD +
  `
uniform vec2 u_off;     // offset in uv, already aspect-free
uniform vec2 u_scale;
uniform vec2 u_anchor;
uniform vec2 u_flip;    // 0 or 1 per axis
uniform float u_rot;    // radians
uniform float u_ar;     // canvas aspect (w/h)
void main(){
  vec2 d = v_uv - u_anchor - u_off;
  d.x *= u_ar;
  float c = cos(-u_rot), s = sin(-u_rot);
  d = vec2(d.x*c - d.y*s, d.x*s + d.y*c);
  d /= u_scale;
  d.x /= u_ar;
  vec2 uv = u_anchor + d;
  uv = mix(uv, 1.0 - uv, u_flip);
  float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  vec4 t = texture(u_tex, clamp(uv, 0.0, 1.0));
  o = vec4(t.rgb * inside, t.a * inside);
}`;

const EPS = 1e-4;

export function withTransform(gl: WebGL2RenderingContext, inner: SourceInstance): SourceInstance {
  let fbo: Fbo | undefined;
  return {
    update(ctx: SourceCtx) {
      const tex = inner.update(ctx);
      const t = ctx.layer.transform;
      if (!t) return tex; // doc predates the field and was not parsed
      const base = `layers.${ctx.layer.id}.transform`;
      const x = ctx.param(`${base}.x`, t.x);
      const y = ctx.param(`${base}.y`, t.y);
      const scale = ctx.param(`${base}.scale`, t.scale);
      const sx = scale * ctx.param(`${base}.scaleX`, t.scaleX);
      const sy = scale * ctx.param(`${base}.scaleY`, t.scaleY);
      const rot = ctx.param(`${base}.rotation`, t.rotation);
      const ax = ctx.param(`${base}.anchorX`, t.anchorX);
      const ay = ctx.param(`${base}.anchorY`, t.anchorY);
      const identity =
        Math.abs(x) < EPS && Math.abs(y) < EPS && Math.abs(rot) < EPS &&
        Math.abs(sx - 1) < EPS && Math.abs(sy - 1) < EPS && !t.flipX && !t.flipY;
      if (identity) return tex;

      fbo = ensureFbo(gl, fbo, ctx.w, ctx.h);
      ctx.target(fbo);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const p = ctx.use("src:transform", VS_QUAD, FS_TRANSFORM);
      p.u.tex("u_tex", 0, tex);
      p.u.v2("u_res", ctx.w, ctx.h);
      p.u.f("u_time", ctx.time);
      p.u.v2("u_off", x, y);
      // a degenerate scale would divide by zero; clamp it to something invisible instead
      p.u.v2("u_scale", Math.abs(sx) < EPS ? EPS : sx, Math.abs(sy) < EPS ? EPS : sy);
      p.u.v2("u_anchor", ax, ay);
      p.u.v2("u_flip", t.flipX ? 1 : 0, t.flipY ? 1 : 0);
      p.u.f("u_rot", (rot * Math.PI) / 180);
      p.u.f("u_ar", ctx.h > 0 ? ctx.w / ctx.h : 1);
      ctx.drawQuad();
      return fbo.tex;
    },
    dispose() {
      inner.dispose();
      if (fbo) deleteFbo(gl, fbo);
    },
  };
}
