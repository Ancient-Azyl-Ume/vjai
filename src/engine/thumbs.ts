// Media helpers for the media browser and the clip deck: which files count as clips,
// what source a clip becomes, and in-page thumbnails (video seeked to 10%, image as is)
// cached in memory by path.
import { fileUrl } from "../rpc";
import { SOURCES } from "./sources";

export const VIDEO_EXTS = ["mp4", "mov", "m4v", "webm"];
export const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp", "gif", "bmp"];
export const MEDIA_EXTS = [...VIDEO_EXTS, ...IMAGE_EXTS];

const THUMB_WIDTH = 160;
const TIMEOUT_MS = 8000;

export function extOf(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? "";
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

export function baseName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

export const isVideo = (path: string) => VIDEO_EXTS.includes(extOf(path));
export const isImage = (path: string) => IMAGE_EXTS.includes(extOf(path));
export const isMedia = (path: string) => isVideo(path) || isImage(path);

// The doc source a clip becomes when it is triggered or dropped on a layer.
// Images only work once an "image" source is registered; until then they stay inert.
// `prev` is the layer's current source: when it is already a video, its transport
// settings (loop, speed, in/out, playing, pingpong, muted, volume) carry over so
// firing a clip does not throw away what the VJ dialled in on that layer.
export function clipSource(path: string, prev?: unknown): Record<string, unknown> | null {
  if (isVideo(path)) {
    const carry = prev && (prev as { type?: string }).type === "video" ? (prev as Record<string, unknown>) : {};
    // startedAt = now, so firing a clip that is already on the layer restarts it
    return { loop: true, speed: 1, ...carry, type: "video", path, startedAt: Date.now() };
  }
  if (isImage(path) && "image" in SOURCES) return { type: "image", path };
  return null;
}

// Extensions a file picker should offer: images only count once an image source is registered.
export function clipExts(): string[] {
  return "image" in SOURCES ? MEDIA_EXTS : VIDEO_EXTS;
}

const cache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

// Already-decoded thumbnail for a path, if any (lets a first render paint without a flash).
export function cachedThumb(path: string): string | undefined {
  return cache.get(path);
}

export function getThumb(path: string): Promise<string | null> {
  const hit = cache.get(path);
  if (hit) return Promise.resolve(hit);
  const inflight = pending.get(path);
  if (inflight) return inflight;
  const url = fileUrl(path);
  const p = (isVideo(path) ? videoThumb(url) : isImage(path) ? imageThumb(url) : Promise.resolve(null))
    .then((data) => {
      if (data) cache.set(path, data);
      pending.delete(path);
      return data;
    })
    .catch(() => {
      pending.delete(path);
      return null;
    });
  pending.set(path, p);
  return p;
}

function draw(src: CanvasImageSource, w: number, h: number): string | null {
  if (!w || !h) return null;
  const scale = Math.min(1, THUMB_WIDTH / w);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * scale));
  c.height = Math.max(1, Math.round(h * scale));
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  try {
    return c.toDataURL("image/jpeg", 0.6);
  } catch {
    return null; // tainted canvas (cross-origin media)
  }
}

function videoThumb(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const el = document.createElement("video");
    let done = false;
    const timer = setTimeout(() => finish(null), TIMEOUT_MS);
    const finish = (v: string | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      el.removeAttribute("src");
      el.load();
      resolve(v);
    };
    el.muted = true;
    el.playsInline = true;
    el.preload = "auto";
    el.crossOrigin = "anonymous";
    el.onloadeddata = () => {
      const t = Number.isFinite(el.duration) && el.duration > 0 ? el.duration * 0.1 : 0;
      if (t < 0.05) finish(draw(el, el.videoWidth, el.videoHeight));
      else el.currentTime = t;
    };
    el.onseeked = () => finish(draw(el, el.videoWidth, el.videoHeight));
    el.onerror = () => finish(null);
    el.src = url;
  });
}

function imageThumb(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const timer = setTimeout(() => finish(null), TIMEOUT_MS);
    const finish = (v: string | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(v);
    };
    img.crossOrigin = "anonymous";
    img.onload = () => finish(draw(img, img.naturalWidth, img.naturalHeight));
    img.onerror = () => finish(null);
    img.src = url;
  });
}
