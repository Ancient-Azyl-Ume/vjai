// Tiny fixed-size ring buffer. Signals and mod outputs keep one each so the
// panels can draw a scope without the engine allocating per frame.
export type Ring = { data: Float32Array; head: number };

export function makeRing(size = 128): Ring {
  return { data: new Float32Array(size), head: 0 };
}

export function pushRing(r: Ring, v: number) {
  r.data[r.head] = v;
  r.head = (r.head + 1) % r.data.length;
}

// Oldest sample first, so a scope reads left to right.
export function readRing(r: Ring, i: number): number {
  return r.data[(r.head + i) % r.data.length];
}
