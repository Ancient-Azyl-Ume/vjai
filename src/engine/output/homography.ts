// Projective map from the unit square to an arbitrary quad (Heckbert, Fundamentals of Texture Mapping).
// Corners in order TL, TR, BR, BL. Returns column-major 3x3 for uniformMatrix3fv.
export function squareToQuad(c: [number, number][]): Float32Array {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = c;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let a, b, cc, d, e, f, g, h;
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
    a = x1 - x0; b = x2 - x1; cc = x0;
    d = y1 - y0; e = y2 - y1; f = y0;
    g = 0; h = 0;
  } else {
    const det = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / det;
    h = (dx1 * dy3 - dx3 * dy1) / det;
    a = x1 - x0 + g * x1; b = x3 - x0 + h * x3; cc = x0;
    d = y1 - y0 + g * y1; e = y3 - y0 + h * y3; f = y0;
  }
  // x' = (a u + b v + c) / (g u + h v + 1)
  return new Float32Array([a, d, g, b, e, h, cc, f, 1]);
}

// Apply a column-major 3x3 to (u, v) with the perspective divide.
export function mapPoint(m: Float32Array, u: number, v: number): [number, number] {
  const w = m[2] * u + m[5] * v + m[8];
  return [(m[0] * u + m[3] * v + m[6]) / w, (m[1] * u + m[4] * v + m[7]) / w];
}

// Inverse of a column-major 3x3 (adjugate; scale is irrelevant after the divide).
export function invert3(m: Float32Array): Float32Array {
  const [a, d, g, b, e, h, c, f, i] = Array.from(m);
  const A = e * i - h * f, B = h * c - b * i, C = b * f - e * c;
  const det = a * A + d * B + g * C;
  const s = det === 0 ? 0 : 1 / det;
  const r10 = (g * f - d * i) * s, r11 = (a * i - g * c) * s, r12 = (d * c - a * f) * s;
  const r20 = (d * h - g * e) * s, r21 = (g * b - a * h) * s, r22 = (a * e - d * b) * s;
  // back to column-major
  return new Float32Array([A * s, r10, r20, B * s, r11, r21, C * s, r12, r22]);
}
