import { fileUrl } from "../../rpc";
import { MEDIA_ELEMENTS, VIDEO_STATUS } from "./media";
import type { SourceDef, SourceOf } from "./types";

// Video file. Each window decodes its own <video>; they stay on the same frame because
// they all derive the playhead from `source.startedAt` (epoch ms of the last (re)start).
// Transport (restart, scrub, resume) is therefore a single doc field: move startedAt.

type Phase = { t: number; forward: boolean };

// Where the clip should be right now, given the in/out window and the loop mode.
export function playhead(s: SourceOf<"video">, dur: number, nowMs: number, anchorMs: number, speed: number): Phase {
  const inP = Math.max(0, dur > 0 ? Math.min(s.in, dur) : s.in);
  const end = s.out > inP ? s.out : dur;
  const outP = Math.max(inP + 0.05, dur > 0 ? Math.min(end, dur) : end || inP + 1);
  const span = outP - inP;
  const elapsed = ((nowMs - anchorMs) / 1000) * speed;
  if (!(elapsed > 0)) return { t: inP, forward: true };
  if (!s.loop) return { t: Math.min(inP + elapsed, outP), forward: true };
  if (s.pingpong) {
    const p = elapsed % (span * 2);
    return p < span ? { t: inP + p, forward: true } : { t: inP + (span * 2 - p), forward: false };
  }
  return { t: inP + (elapsed % span), forward: true };
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export const videoSource: SourceDef<"video"> = {
  type: "video",
  key: (layer) => layer.source.path,
  create(gl, layer) {
    const el = document.createElement("video");
    el.src = fileUrl(layer.source.path);
    el.muted = true;
    el.loop = false; // looping is driven from the doc so in/out points work
    el.playsInline = true;
    el.preload = "auto";
    el.play().catch(() => {});
    // fallback anchor for docs that never set startedAt
    const localAnchor = Date.now();
    let lastAnchor = -1;
    MEDIA_ELEMENTS.set(layer.id, el);

    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // transparent until the first frame decodes, so layers below show through while loading
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));

    return {
      update(ctx) {
        const s = ctx.source;
        const dur = Number.isFinite(el.duration) ? el.duration : 0;
        const speed = ctx.param(`layers.${ctx.layer.id}.source.speed`, s.speed);
        const rate = Math.max(0.0625, Math.min(16, Math.abs(speed) || 1));
        if (el.muted !== s.muted) el.muted = s.muted;
        const vol = clamp01(ctx.param(`layers.${ctx.layer.id}.source.volume`, s.volume));
        if (el.volume !== vol) el.volume = vol;

        if (el.readyState >= 1 && dur > 0) {
          const anchor = s.startedAt > 0 ? s.startedAt : localAnchor;
          const ph = playhead(s, dur, Date.now(), anchor, rate);
          if (!s.playing) {
            // paused: hold the frame; a moved startedAt (scrub while paused) seeks once
            if (!el.paused) el.pause();
            if (s.startedAt !== lastAnchor && !el.seeking) el.currentTime = ph.t;
          } else if (!ph.forward) {
            // reverse half of a ping-pong: <video> cannot play backwards, so step by seeking
            if (!el.paused) el.pause();
            if (!el.seeking && Math.abs(el.currentTime - ph.t) > 1 / 60) el.currentTime = ph.t;
          } else {
            if (el.playbackRate !== rate) el.playbackRate = rate;
            if (el.paused) el.play().catch(() => {});
            if (!el.seeking && Math.abs(el.currentTime - ph.t) > 0.35) el.currentTime = ph.t;
          }
          lastAnchor = s.startedAt;
        }

        VIDEO_STATUS.set(ctx.layer.id, { duration: dur, time: el.currentTime, ready: el.readyState >= 2, paused: el.paused });

        if (el.readyState >= 2) {
          gl.bindTexture(gl.TEXTURE_2D, tex);
          // video frames are y-down; flip on upload so the texture is y-up like every other source
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        }
        return tex;
      },
      dispose() {
        MEDIA_ELEMENTS.delete(layer.id);
        VIDEO_STATUS.delete(layer.id);
        el.pause();
        el.removeAttribute("src");
        el.load();
        gl.deleteTexture(tex);
      },
    };
  },
};
