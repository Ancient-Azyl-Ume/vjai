import { FS_HEAD } from "../core/shaders";
import type { EffectDef } from "./types";

// Time-seeded digital glitch: per-row block displacement plus wider scanline tears
// and a colour split that follows the same seed.
export const glitch: EffectDef<"glitch"> = {
  type: "glitch",
  label: "glitch",
  defaults: { amount: 0.5, blocks: 24, speed: 1, split: 0.5 },
  ranges: {
    amount: { min: 0, max: 1 },
    blocks: { min: 1, max: 128, step: 1 },
    speed: { min: 0, max: 20 },
    split: { min: 0, max: 2 },
  },
  fragment: FS_HEAD + `
uniform float p_amount, p_blocks, p_speed, p_split;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  float amt = clamp(p_amount, 0.0, 1.0);
  float seed = floor(u_time * max(p_speed, 0.0) * 12.0);
  vec2 uv = v_uv;

  // narrow block rows: a few of them jump sideways
  float row = floor(v_uv.y * max(p_blocks, 1.0));
  float pick = hash(vec2(row, seed));
  float on = step(1.0 - amt * 0.6, pick);
  uv.x += (hash(vec2(row * 3.7 + 1.0, seed)) - 0.5) * 0.4 * amt * on;

  // wide tear band: whole slab shifts hard
  float band = floor(v_uv.y * 6.0);
  float tear = step(1.0 - amt * 0.3, hash(vec2(band, seed * 1.7 + 3.0)));
  uv.x += (hash(vec2(seed, band * 2.3)) - 0.5) * amt * tear;

  uv.x = fract(uv.x);
  vec2 d = vec2(p_split * amt * 12.0 / u_res.x, 0.0);
  vec4 c = texture(u_tex, uv);
  o = vec4(texture(u_tex, fract(uv + d)).r, c.g, texture(u_tex, fract(uv - d)).b, c.a);
}`,
};
