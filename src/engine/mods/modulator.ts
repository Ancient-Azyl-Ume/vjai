import type { Doc, Mod } from "../../doc/schema";
import { getPath } from "../../doc/schema";
import { targetBase } from "./targets";
import type { SignalName, Signals } from "../audio/analyser";
import { makeRing, pushRing, type Ring } from "../audio/ring";

// Resolves the modulation matrix into per-frame parameter overrides.
//
//   value = base + amount * (min + (max - min) * x)
//
// where x is the shaped source signal: curve, invert, smoothing, then unipolar 0..1
// or bipolar -1..1, optionally sample-and-held on the beat.
export class Modulator {
  values = new Map<string, number>(); // target path -> modulated value
  raw = new Map<string, number>(); // mod id -> source signal, for the scopes
  out = new Map<string, number>(); // mod id -> mapped output
  history = new Map<string, { raw: Ring; out: Ring }>();

  private smoothed = new Map<string, number>();
  private env = new Map<string, number>();
  private held = new Map<string, number>();
  private rand = new Map<string, { cycle: number; a: number; b: number }>();
  private lastT = 0;
  private prevBeat = 0;
  private prevPhase = 0;
  // musical time in beats, unwrapped from the clock phase so synced LFOs stay locked
  private beatPos = 0;

  resolve(doc: Doc, sig: Signals, tSec: number) {
    const dt = this.lastT ? Math.max(0, Math.min(0.25, tSec - this.lastT)) : 0;
    this.lastT = tSec;
    if (sig.phase < this.prevPhase) this.beatPos = Math.floor(this.beatPos) + 1 + sig.phase;
    else this.beatPos = Math.floor(this.beatPos) + sig.phase;
    this.prevPhase = sig.phase;
    const beatHit = sig.beat > 0.9 && this.prevBeat <= 0.9;
    this.prevBeat = sig.beat;

    this.values.clear();
    // mods that drive a macro resolve first, so a mod reading that macro sees the
    // modulated value in the same frame
    const ordered = [...doc.mods].sort((a, b) => Number(b.target.startsWith("macros.")) - Number(a.target.startsWith("macros.")));
    for (const m of ordered) {
      if (!m.enabled) continue;
      const base = targetBase(doc, m.target);
      if (base === undefined) continue;
      let s = this.signal(m, sig, tSec, dt, doc);
      if (!Number.isFinite(s)) continue;
      s = Math.max(0, Math.min(1, s));
      if (m.curve !== 1) s = Math.pow(s, m.curve);
      if (m.invert) s = 1 - s;

      // Musical smoothing: attack is near-instant, release comes from the smooth knob.
      // An LFO is already an envelope, so it bypasses this - a square has to drop, not
      // decay. Reach for the "smooth" shape when a rounded random is what you want.
      let sm = s;
      if (m.source !== "lfo") {
        const prev = this.smoothed.get(m.id) ?? s;
        const rise = 1 - Math.exp(-dt / 0.008);
        const fall = 1 - Math.exp(-dt / (0.008 + m.smooth * 1.2));
        sm = dt > 0 ? prev + (s - prev) * (s > prev ? rise : fall) : s;
      }
      this.smoothed.set(m.id, sm);

      let v = sm;
      if (m.hold) {
        if (beatHit || !this.held.has(m.id)) this.held.set(m.id, sm);
        v = this.held.get(m.id)!;
      }
      const x = m.bipolar ? v * 2 - 1 : v;
      const mapped = m.min + (m.max - m.min) * x;

      this.raw.set(m.id, s);
      this.out.set(m.id, mapped);
      let h = this.history.get(m.id);
      if (!h) {
        h = { raw: makeRing(160), out: makeRing(160) };
        this.history.set(m.id, h);
      }
      pushRing(h.raw, s);
      pushRing(h.out, mapped);

      const cur = this.values.get(m.target) ?? base;
      this.values.set(m.target, cur + m.amount * mapped);
    }
    return this.values;
  }

  private signal(m: Mod, sig: Signals, t: number, dt: number, doc: Doc): number {
    switch (m.source) {
      case "lfo":
        return this.lfo(m, t);
      case "env":
        return this.follower(m, sig, dt);
      // hand-driven knob in doc.macros, itself modulatable
      case "macro": {
        const path = `macros.${m.sourceId}.value`;
        return this.values.get(path) ?? (Number(getPath(doc, path)) || 0);
      }
      default:
        return sig[m.source as SignalName] ?? 0;
    }
  }

  private lfo(m: Mod, t: number): number {
    const pos = m.sync ? this.beatPos / Math.max(0.0625, m.rateBeats) + m.offset : t * m.rate + m.offset;
    const ph = pos - Math.floor(pos);
    switch (m.shape) {
      case "tri":
        return 1 - Math.abs(2 * ph - 1);
      case "saw":
        return ph;
      case "square":
        return ph < 0.5 ? 1 : 0;
      case "rnd":
      case "smooth": {
        const cycle = Math.floor(pos);
        let r = this.rand.get(m.id);
        if (!r) {
          r = { cycle, a: Math.random(), b: Math.random() };
          this.rand.set(m.id, r);
        }
        if (cycle < r.cycle || cycle - r.cycle > 4) {
          r.cycle = cycle;
          r.a = r.b;
          r.b = Math.random();
        }
        while (r.cycle < cycle) {
          r.a = r.b;
          r.b = Math.random();
          r.cycle++;
        }
        if (m.shape === "rnd") return r.b;
        const k = ph * ph * (3 - 2 * ph); // smoothstep between the two draws
        return r.a + (r.b - r.a) * k;
      }
      default:
        return 0.5 + 0.5 * Math.sin(ph * Math.PI * 2);
    }
  }

  private follower(m: Mod, sig: Signals, dt: number): number {
    const x = sig[m.envInput] ?? 0;
    const prev = this.env.get(m.id) ?? x;
    const tau = Math.max(0.001, (x > prev ? m.attack : m.release) / 1000);
    const v = dt > 0 ? prev + (x - prev) * (1 - Math.exp(-dt / tau)) : x;
    this.env.set(m.id, v);
    return v;
  }
}
