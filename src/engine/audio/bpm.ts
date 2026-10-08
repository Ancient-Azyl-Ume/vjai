// Tempo: an autocorrelation estimator over the recent onset train, plus the beat
// clock everything musical hangs off (phase, beat and bar impulses, tap tempo).

const BIN_MS = 10; // onset envelope resolution
const BINS = 800; // 8 s of history
const MIN_BPM = 70;
const MAX_BPM = 180;

export class BpmEstimator {
  bpm = 0;
  confidence = 0;
  private env = new Float32Array(BINS);
  private head = 0;
  private binAt = 0;
  private lastRun = 0;

  // `strength` is 0..1; feed it every frame (0 when nothing happened).
  add(now: number, strength: number) {
    if (!this.binAt) this.binAt = now;
    // advance whole bins, clearing as we go; a long stall just resets the window
    if (now - this.binAt > BINS * BIN_MS) {
      this.env.fill(0);
      this.binAt = now;
    }
    while (now - this.binAt >= BIN_MS) {
      this.head = (this.head + 1) % BINS;
      this.env[this.head] = 0;
      this.binAt += BIN_MS;
    }
    if (strength > this.env[this.head]) this.env[this.head] = strength;
  }

  // Runs at most twice a second: ~50 lags x 800 bins is cheap but not free.
  estimate(now: number) {
    if (now - this.lastRun < 500) return;
    this.lastRun = now;
    const n = BINS;
    const e = new Float32Array(n);
    let mean = 0;
    for (let i = 0; i < n; i++) {
      e[i] = this.env[(this.head + 1 + i) % n];
      mean += e[i];
    }
    mean /= n;
    if (mean < 0.002) {
      // nothing to lock onto: let confidence bleed away, keep the last bpm
      this.confidence *= 0.8;
      return;
    }
    for (let i = 0; i < n; i++) e[i] -= mean; // remove DC, else every lag correlates

    const lagMin = Math.floor(60000 / MAX_BPM / BIN_MS);
    const lagMax = Math.ceil(60000 / MIN_BPM / BIN_MS);
    const corr = new Float32Array(lagMax - lagMin + 1);
    let best = 0;
    let bestLag = 0;
    let sum = 0;
    for (let lag = lagMin; lag <= lagMax; lag++) {
      let acc = 0;
      for (let i = lag; i < n; i++) acc += e[i] * e[i - lag];
      acc /= n - lag;
      corr[lag - lagMin] = acc;
      sum += acc;
      if (acc > best) {
        best = acc;
        bestLag = lag;
      }
    }
    if (!bestLag || best <= 0) {
      this.confidence *= 0.8;
      return;
    }
    const avg = Math.abs(sum / corr.length) + 1e-9;
    // parabolic interpolation around the peak: 10 ms bins alone are +-1.5 bpm at 130
    let lag = bestLag;
    const k = bestLag - lagMin;
    if (k > 0 && k < corr.length - 1) {
      const d = corr[k - 1] - 2 * corr[k] + corr[k + 1];
      if (d !== 0) lag += Math.max(-0.5, Math.min(0.5, (0.5 * (corr[k - 1] - corr[k + 1])) / d));
    }
    this.bpm = 60000 / (lag * BIN_MS);
    // how much the winning lag stands out from the field
    this.confidence = Math.max(0, Math.min(1, (best / avg - 1) / 3));
  }
}

export class BeatClock {
  bpm = 120;
  phase = 0; // 0..1 inside the current beat
  beat = 0; // impulse, decays over ~80 ms
  bar = 0;
  beats = 0;
  private last = 0;
  private taps: number[] = [];

  tick(now: number, bpm: number, onset: number) {
    const dt = this.last ? Math.min(0.25, (now - this.last) / 1000) : 0;
    this.last = now;
    this.bpm = Math.max(40, Math.min(240, bpm));
    this.phase += (dt * this.bpm) / 60;
    // a strong onset close to a beat line pulls the phase onto it (gentle PLL)
    if (onset > 0.9) {
      const frac = this.phase - Math.floor(this.phase);
      const err = frac < 0.5 ? -frac : 1 - frac;
      if (Math.abs(err) < 0.25) this.phase += err * 0.3;
    }
    let hit = false;
    while (this.phase >= 1) {
      this.phase -= 1;
      this.beats++;
      hit = true;
    }
    if (this.phase < 0) this.phase = 0;
    const decay = Math.exp(-dt / 0.08);
    this.beat = hit ? 1 : this.beat * decay;
    this.bar = hit && this.beats % 4 === 0 ? 1 : this.bar * decay;
  }

  // Tap tempo: returns the new bpm once there are enough taps, else 0.
  tap(now: number): number {
    if (this.taps.length && now - this.taps[this.taps.length - 1] > 2000) this.taps = [];
    this.taps.push(now);
    if (this.taps.length > 8) this.taps.shift();
    // a tap is also a downbeat
    this.phase = 0;
    this.beats = 0;
    this.beat = 1;
    this.bar = 1;
    if (this.taps.length < 2) return 0;
    let sum = 0;
    for (let i = 1; i < this.taps.length; i++) sum += this.taps[i] - this.taps[i - 1];
    const avg = sum / (this.taps.length - 1);
    if (avg <= 0) return 0;
    return Math.max(40, Math.min(240, 60000 / avg));
  }
}
