import type { Doc, Layer, Output } from "../../doc/schema";
import { BlendModes } from "../../doc/schema";
import { createFbo, createGrid, createProg, deleteFbo, type Fbo, type Prog } from "./gl";
import { FS_BLEND, FS_COPY, VS_QUAD } from "./shaders";
import { EFFECT_LIST, EFFECTS } from "../effects";
import { createSource, sourceKey, type SourceCtx, type SourceInstance } from "../sources";
import { applyMask } from "../sources/mask";
import { FS_SLICE, VS_WARP } from "../output/warp";
import { drawOutput } from "../output/slice";
import { AudioAnalyser } from "../audio/analyser";
import { Modulator } from "../mods/modulator";

export type ViewMode = { kind: "composite" } | { kind: "output"; id: string };

// One Engine per window. Renders the layer stack into a composite FBO, then either
// shows the composite (preview) or draws an output's warped slices (projector window).
// Sources, effects and the output warp live in their own modules; this file is the
// frame loop and the plumbing between them.
export class Engine {
  gl: WebGL2RenderingContext;
  doc!: Doc;
  audio = new AudioAnalyser();
  mods = new Modulator();
  private progs = new Map<string, Prog>();
  private grid: { vao: WebGLVertexArrayObject; count: number };
  private composite!: Fbo;
  private ping!: Fbo;
  private pong!: Fbo;
  private feedback = new Map<string, Fbo>();
  private layerScratch = new Map<number, Fbo>();
  private sources = new Map<string, { key: string; inst: SourceInstance }>();
  private start = performance.now();
  private raf = 0;
  private snapshotRequest?: (dataUrl: string) => void;
  onFrame?: (e: Engine) => void;
  canvas: HTMLCanvasElement;
  // Each panel/window that shows a picture is a view: a 2D canvas we blit into after rendering its mode.
  private views = new Map<string, { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; mode: ViewMode }>();

  constructor() {
    const canvas = document.createElement("canvas");
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, preserveDrawingBuffer: false })!;
    if (!gl) throw new Error("WebGL2 not available");
    this.gl = gl;
    this.grid = createGrid(gl, 48);
    this.progs.set("copy", createProg(gl, VS_QUAD, FS_COPY));
    this.progs.set("blend", createProg(gl, VS_QUAD, FS_BLEND));
    this.progs.set("slice", createProg(gl, VS_WARP, FS_SLICE));
    for (const e of EFFECT_LIST) this.progs.set("fx:" + e.type, createProg(gl, VS_QUAD, e.fragment));
    this.ensureBuffers(1920, 1080);
  }

  addView(id: string, canvas: HTMLCanvasElement, mode: ViewMode) {
    const ctx = canvas.getContext("2d")!;
    this.views.set(id, { canvas, ctx, mode });
  }

  setViewMode(id: string, mode: ViewMode) {
    const v = this.views.get(id);
    if (v) v.mode = mode;
  }

  removeView(id: string) {
    this.views.delete(id);
  }

  setDoc(doc: Doc) {
    this.doc = doc;
    this.ensureBuffers(doc.canvas.width, doc.canvas.height);
    this.audio.gain = doc.audio.gain;
    this.audio.kickThreshold = doc.audio.kickThreshold;
    // drop source instances whose layer is gone or whose identity changed (e.g. a video path)
    for (const [id, s] of this.sources) {
      const l = doc.layers.find((x) => x.id === id);
      if (!l || sourceKey(l) !== s.key) {
        s.inst.dispose();
        this.sources.delete(id);
      }
    }
  }

  private ensureBuffers(w: number, h: number) {
    if (this.composite && this.composite.w === w && this.composite.h === h) return;
    const gl = this.gl;
    if (this.composite) { deleteFbo(gl, this.composite); deleteFbo(gl, this.ping); deleteFbo(gl, this.pong); }
    for (const f of this.feedback.values()) deleteFbo(gl, f);
    this.feedback.clear();
    this.composite = createFbo(gl, w, h);
    this.ping = createFbo(gl, w, h);
    this.pong = createFbo(gl, w, h);
  }

  run() {
    const loop = () => {
      this.frame();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }

  snapshot(): Promise<string> {
    return new Promise((res) => (this.snapshotRequest = res));
  }

  get time() {
    return (performance.now() - this.start) / 1000;
  }

  // ----- helpers shared with sources -----
  private drawQuad() {
    const gl = this.gl;
    gl.bindVertexArray(this.grid.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.grid.count);
  }

  // Activate a program; compiles and caches it on first use when vs/fs are given.
  private use(name: string, vs?: string, fs?: string): Prog {
    let p = this.progs.get(name);
    if (!p) {
      if (!vs || !fs) throw new Error("unknown program: " + name);
      p = createProg(this.gl, vs, fs);
      this.progs.set(name, p);
    }
    this.gl.useProgram(p.prog);
    return p;
  }

  private target(f: Fbo | null, w?: number, h?: number) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, f ? f.fb : null);
    gl.viewport(0, 0, f ? f.w : w!, f ? f.h : h!);
  }

  // Modulation-aware param read: what a mod currently drives at `path`, else the doc value.
  private param(path: string, base: number) {
    return this.mods.values.get(path) ?? base;
  }

  // ----- per-frame -----
  frame() {
    if (!this.doc) return;
    const gl = this.gl, doc = this.doc, t = this.time;
    const sig = this.audio.update(performance.now());
    this.mods.resolve(doc, sig, t);
    const W = this.composite.w, H = this.composite.h;

    // clear composite
    this.target(this.composite);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    let base = this.composite; // texture holding the stack so far
    let scratch = this.pong;
    // solo: while any enabled layer is soloed, the others sit out
    const solo = doc.layers.some((l) => l.enabled && l.solo);
    for (let li = 0; li < doc.layers.length; li++) {
      const layer = doc.layers[li];
      if (!layer.enabled || (solo && !layer.solo)) continue;
      const opacity = Math.max(0, Math.min(1, this.param(`layers.${layer.id}.opacity`, layer.opacity)));
      if (opacity <= 0) continue;
      const layerTex = this.renderLayer(layer, li, t, W, H, base.tex);
      // blend layer onto base -> scratch, then swap
      this.target(scratch);
      const p = this.use("blend");
      p.u.tex("u_base", 0, base.tex);
      p.u.tex("u_tex", 1, layerTex);
      p.u.v2("u_res", W, H);
      p.u.f("u_opacity", opacity);
      p.u.i("u_mode", BlendModes.indexOf(layer.blend));
      this.drawQuad();
      const tmp = base; base = scratch; scratch = tmp;
    }
    if (base !== this.composite) {
      this.target(this.composite);
      const p = this.use("copy");
      p.u.tex("u_tex", 0, base.tex);
      this.drawQuad();
    }

    // present each view: render its mode into the GL canvas at the view's size, then blit
    let first = true;
    for (const v of this.views.values()) {
      const cw = v.canvas.width, ch = v.canvas.height;
      if (cw === 0 || ch === 0) continue;
      if (this.canvas.width !== cw || this.canvas.height !== ch) { this.canvas.width = cw; this.canvas.height = ch; }
      this.target(null, cw, ch);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (v.mode.kind === "composite") {
        const p = this.use("copy");
        p.u.tex("u_tex", 0, this.composite.tex);
        this.drawQuad();
      } else {
        const out = doc.outputs.find((o) => o.id === (v.mode as { id: string }).id);
        if (out) this.drawOutput(out, cw, ch);
      }
      v.ctx.drawImage(this.canvas, 0, 0);
      if (first && this.snapshotRequest) {
        const cb = this.snapshotRequest;
        this.snapshotRequest = undefined;
        cb(v.canvas.toDataURL("image/jpeg", 0.6));
      }
      first = false;
    }

    this.onFrame?.(this);
  }

  // Source -> effect chain. Returns the texture holding the finished layer.
  private renderLayer(layer: Layer, li: number, t: number, W: number, H: number, baseTex: WebGLTexture): WebGLTexture {
    const ctx: SourceCtx = {
      layer, source: layer.source, time: t, w: W, h: H,
      use: (name, vs, fs) => this.use(name, vs, fs),
      target: (f) => this.target(f),
      drawQuad: () => this.drawQuad(),
      param: (path, base) => this.param(path, base),
    };
    let tex = this.sourceFor(layer).update(ctx);
    // effect chain alternates between ping and this layer's scratch buffer
    const bufs = [this.ping, this.scratchFor(li)];
    let b = 0;
    for (const fx of layer.effects) {
      if (!fx.enabled) continue;
      const def = EFFECTS[fx.type];
      if (!def) continue;
      const out = bufs[b];
      b ^= 1;
      this.target(out);
      const p = this.use("fx:" + fx.type);
      p.u.tex("u_tex", 0, tex);
      p.u.v2("u_res", W, H);
      p.u.f("u_time", t);
      for (const k of Object.keys(def.defaults)) {
        const base = fx.params[k] ?? def.defaults[k];
        p.u.f("p_" + k, this.param(`layers.${layer.id}.effects.${fx.id}.params.${k}`, base));
      }
      if (def.needsFeedback) {
        const fb = this.feedbackFor(layer.id + ":" + fx.id, W, H);
        p.u.tex("u_prev", 1, fb.tex);
        this.drawQuad();
        // keep this frame for the next one
        this.target(fb);
        const c = this.use("copy");
        c.u.tex("u_tex", 0, out.tex);
        this.drawQuad();
      } else {
        this.drawQuad();
      }
      tex = out.tex;
    }
    // mask runs after the chain, at composite time; bufs[b] is the idle half of the ping-pong
    return applyMask(ctx, layer, tex, baseTex, bufs[b]);
  }

  private sourceFor(layer: Layer): SourceInstance {
    const key = sourceKey(layer);
    let s = this.sources.get(layer.id);
    if (s && s.key !== key) {
      s.inst.dispose();
      s = undefined;
    }
    if (!s) {
      s = { key, inst: createSource(this.gl, layer) };
      this.sources.set(layer.id, s);
    }
    return s.inst;
  }

  private feedbackFor(key: string, W: number, H: number): Fbo {
    let fb = this.feedback.get(key);
    if (!fb) { fb = createFbo(this.gl, W, H); this.feedback.set(key, fb); }
    return fb;
  }

  private scratchFor(li: number): Fbo {
    // effect chains need a second buffer that is not the composite ping-pong pair
    let f = this.layerScratch.get(li);
    if (!f || f.w !== this.composite.w || f.h !== this.composite.h) {
      if (f) deleteFbo(this.gl, f);
      f = createFbo(this.gl, this.composite.w, this.composite.h);
      this.layerScratch.set(li, f);
    }
    return f;
  }

  private drawOutput(out: Output, cw: number, ch: number) {
    const p = this.use("slice");
    drawOutput(this.gl, p, () => this.drawQuad(), this.composite.tex, out, cw, ch);
  }
}
