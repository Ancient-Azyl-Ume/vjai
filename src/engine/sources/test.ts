import { deleteFbo, ensureFbo, type Fbo } from "../core/gl";
import { FS_HEAD, VS_QUAD } from "../core/shaders";
import type { SourceDef } from "./types";

const PATTERNS = ["grid", "bars", "noise", "circles"];

const FS_TEST = FS_HEAD + `
uniform int u_pattern;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
void main(){
  vec2 uv = v_uv; float ar = u_res.x/u_res.y;
  vec3 c = vec3(0.0);
  if (u_pattern == 0) { // grid + crosshair
    vec2 g = abs(fract(uv*vec2(16.0*ar,16.0)) - 0.5);
    float l = smoothstep(0.47, 0.5, max(g.x, g.y));
    float cross = step(abs(uv.x-0.5), 0.002) + step(abs(uv.y-0.5), 0.002*ar);
    float border = step(uv.x, 0.005) + step(0.995, uv.x) + step(uv.y, 0.005*ar) + step(1.0-0.005*ar, uv.y);
    c = vec3(l*0.5) + vec3(1.0,0.2,0.2)*clamp(cross,0.0,1.0) + vec3(0.2,1.0,0.2)*clamp(border,0.0,1.0);
  } else if (u_pattern == 1) { // bars
    float b = floor(uv.x*8.0);
    c = vec3(mod(b,2.0), mod(floor(b/2.0),2.0), mod(floor(b/4.0),2.0));
  } else if (u_pattern == 2) { // noise
    c = vec3(hash(floor(uv*vec2(160.0*ar,90.0)) + floor(u_time*24.0)));
  } else { // moving circles
    vec2 p = (uv-0.5)*vec2(ar,1.0);
    float r = length(p);
    c = vec3(0.5+0.5*sin(r*40.0 - u_time*4.0)) * vec3(0.4,0.7,1.0);
  }
  o = vec4(c, 1.0);
}`;

export const testSource: SourceDef<"test"> = {
  type: "test",
  create(gl) {
    let fbo: Fbo | undefined;
    return {
      update(ctx) {
        fbo = ensureFbo(gl, fbo, ctx.w, ctx.h);
        ctx.target(fbo);
        const p = ctx.use("src:test", VS_QUAD, FS_TEST);
        p.u.v2("u_res", ctx.w, ctx.h);
        p.u.f("u_time", ctx.time);
        p.u.i("u_pattern", PATTERNS.indexOf(ctx.source.pattern));
        ctx.drawQuad();
        return fbo.tex;
      },
      dispose() {
        if (fbo) deleteFbo(gl, fbo);
      },
    };
  },
};
