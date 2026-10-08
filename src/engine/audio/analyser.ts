import { useDoc } from "../../doc/store";
import { BeatClock, BpmEstimator } from "./bpm";
import { makeRing, pushRing, type Ring } from "./ring";

// Live mic/loopback analysis. Every window runs its own instance on the same device
// so no per-frame IPC is needed between UI and projector windows.
//
// Levels (rms/bass/mid/high) are 0..1. kick/snare/hat are onset impulses that decay
// over ~80 ms; beat/bar come from the beat clock, which free-runs at the current bpm
// even without audio, so LFO sync and sample-and-hold still work in silence.

export const SIGNAL_NAMES = ["rms", "bass", "mid", "high", "kick", "snare", "hat", "beat", "bar", "phase"] as const;
export type SignalName = (typeof SIGNAL_NAMES)[number];
export type Signals = Record<SignalName, number>;

const zeroSignals = (): Signals => Object.fromEntries(SIGNAL_NAMES.map((k) => [k, 0])) as Signals;

const BANDS: Record<"bass" | "mid" | "high", [number, number]> = {
  bass: [20, 150],
  mid: [150, 2000],
  high: [2000, 12000],
};

export async function listInputDevices(): Promise<{ id: string; label: string }[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    return all
      .filter((d) => d.kind === "audioinput")
      .map((d, i) => ({ id: d.deviceId, label: d.label || `input ${i + 1}` }));
  } catch {
    return [];
  }
}

// Spectral-flux onset detector with an adaptive threshold: fire when the flux beats
// mean + sensitivity * stddev of the last ~1 s, outside a per-band refractory window.
class Onset {
  private hist = new Float32Array(64);
  private i = 0;
  private last = 0;
  value = 0;

  constructor(private refractoryMs: number) {}

  update(flux: number, now: number, sensitivity: number, decay: number): boolean {
    let mean = 0;
    for (const v of this.hist) mean += v;
    mean /= this.hist.length;
    let variance = 0;
    for (const v of this.hist) variance += (v - mean) * (v - mean);
    const std = Math.sqrt(variance / this.hist.length);
    this.hist[this.i] = flux;
    this.i = (this.i + 1) % this.hist.length;

    const threshold = mean + sensitivity * std;
    const fired = flux > threshold && flux > 0.004 && now - this.last > this.refractoryMs;
    if (fired) {
      this.last = now;
      this.value = 1;
    } else {
      this.value *= decay;
    }
    return fired;
  }
}

export class AudioAnalyser {
  signals: Signals = zeroSignals();
  history = Object.fromEntries(SIGNAL_NAMES.map((k) => [k, makeRing(160)])) as Record<SignalName, Ring>;
  gain = 1;
  kickThreshold = 1.6; // onset sensitivity (kept under the old name: the engine assigns it)
  running = false;
  error = "";
  deviceId = "";
  clock = new BeatClock();
  estimator = new BpmEstimator();

  private ctx?: AudioContext;
  private stream?: MediaStream;
  private analyser?: AnalyserNode;
  private freq?: Float32Array;
  private time?: Float32Array;
  private mag?: Float32Array;
  private prevMag?: Float32Array;
  private onsets = { kick: new Onset(120), snare: new Onset(90), hat: new Onset(60) };
  private lastNow = 0;
  private docBpm = 120;
  private bpmLock = false;

  constructor() {
    // The analyser configures itself from the doc, so it behaves the same in the UI
    // window and in a projector window, whichever panels happen to be mounted.
    const apply = () => {
      const a = useDoc.getState().doc.audio;
      this.gain = a.gain;
      this.kickThreshold = a.kickThreshold;
      this.docBpm = a.bpm;
      this.bpmLock = a.bpmLock;
      if (a.deviceId !== this.deviceId) {
        this.deviceId = a.deviceId;
        if (this.running) void this.start(a.deviceId);
      }
    };
    apply();
    useDoc.subscribe(apply);
  }

  get bpm() {
    return this.clock.bpm;
  }

  get confidence() {
    return this.estimator.confidence;
  }

  // Resolves true when capture is live. On failure `error` holds the reason and
  // `running` stays false: callers must light "audio live" off `running`, never off
  // the fact that start() resolved.
  async start(deviceId?: string): Promise<boolean> {
    const id = deviceId ?? this.deviceId;
    this.stop();
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("no audio input in this browser");
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: id ? { exact: id } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (e) {
      this.error = String((e as Error)?.message ?? e);
      return false;
    }
    this.error = "";
    this.deviceId = id;
    this.ctx = new AudioContext();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.4;
    src.connect(this.analyser);
    this.freq = new Float32Array(this.analyser.frequencyBinCount);
    this.time = new Float32Array(this.analyser.fftSize);
    this.mag = new Float32Array(this.analyser.frequencyBinCount);
    this.prevMag = new Float32Array(this.analyser.frequencyBinCount);
    this.running = true;
    return true;
  }

  stop() {
    this.running = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
    void this.ctx?.close();
    this.ctx = undefined;
    this.analyser = undefined;
  }

  // Returns the tapped bpm (0 until there are two taps). The caller writes it to the doc.
  tap(): number {
    return this.clock.tap(performance.now());
  }

  private binRange(lo: number, hi: number, len: number, nyq: number) {
    return [Math.max(0, Math.floor((lo / nyq) * len)), Math.min(len - 1, Math.ceil((hi / nyq) * len))] as const;
  }

  update(now: number) {
    const dt = this.lastNow ? Math.min(0.25, (now - this.lastNow) / 1000) : 1 / 60;
    this.lastNow = now;
    const decay = Math.exp(-dt / 0.08);

    let rms = 0;
    const levels = { bass: 0, mid: 0, high: 0 };
    let kick = this.signals.kick * decay;
    let snare = this.signals.snare * decay;
    let hat = this.signals.hat * decay;
    let onsetStrength = 0;

    if (this.running && this.analyser) {
      this.analyser.getFloatFrequencyData(this.freq! as Float32Array<ArrayBuffer>);
      this.analyser.getFloatTimeDomainData(this.time! as Float32Array<ArrayBuffer>);
      const mag = this.mag!;
      const prev = this.prevMag!;
      for (let i = 0; i < mag.length; i++) mag[i] = Math.pow(10, this.freq![i] / 20);

      let sq = 0;
      for (const v of this.time!) sq += v * v;
      rms = Math.min(1, Math.sqrt(sq / this.time!.length) * 4 * this.gain);

      const nyq = this.ctx!.sampleRate / 2;
      const flux = { bass: 0, mid: 0, high: 0 };
      for (const name of ["bass", "mid", "high"] as const) {
        const [i0, i1] = this.binRange(BANDS[name][0], BANDS[name][1], mag.length, nyq);
        let sum = 0;
        let f = 0;
        for (let i = i0; i <= i1; i++) {
          sum += mag[i];
          const d = mag[i] - prev[i];
          if (d > 0) f += d;
        }
        const n = Math.max(1, i1 - i0 + 1);
        levels[name] = Math.min(1, (sum / n) * 40 * this.gain);
        flux[name] = (f / n) * 40 * this.gain;
      }
      prev.set(mag);

      const sens = this.kickThreshold;
      if (this.onsets.kick.update(flux.bass, now, sens, decay)) onsetStrength = 1;
      if (this.onsets.snare.update(flux.mid, now, sens, decay)) onsetStrength = Math.max(onsetStrength, 0.8);
      this.onsets.hat.update(flux.high, now, sens, decay);
      kick = this.onsets.kick.value;
      snare = this.onsets.snare.value;
      hat = this.onsets.hat.value;
    }

    // Tempo. The estimator only drives the clock when it is confident and the user
    // has not pinned the bpm by typing or tapping it.
    this.estimator.add(now, onsetStrength);
    this.estimator.estimate(now);
    const useEstimate = !this.bpmLock && this.estimator.confidence > 0.35 && this.estimator.bpm > 0;
    this.clock.tick(now, useEstimate ? this.estimator.bpm : this.docBpm, kick);

    this.signals = {
      rms,
      bass: levels.bass,
      mid: levels.mid,
      high: levels.high,
      kick,
      snare,
      hat,
      beat: this.clock.beat,
      bar: this.clock.bar,
      phase: this.clock.phase,
    };
    for (const k of SIGNAL_NAMES) pushRing(this.history[k], this.signals[k]);
    return this.signals;
  }
}
