import type { Mesh, Slice } from "../../doc/schema";
import { invert3, mapPoint, squareToQuad } from "./homography";

// The mesh is a displacement field on top of the corner-pin homography: control point
// (i, j) stores how far the surface moves from where the homography would put it.
// All-zero offsets are exactly the plain corner pin, which is why old docs still work.

export function meshActive(mesh: Mesh): boolean {
  return mesh.enabled && mesh.offsets.length === mesh.cols * mesh.rows && mesh.cols >= 2 && mesh.rows >= 2;
}

export function zeroOffsets(cols: number, rows: number): [number, number][] {
  return Array.from({ length: cols * rows }, () => [0, 0] as [number, number]);
}

// UV of control point (i, j) on the unit square.
export function gridUv(mesh: Mesh, i: number, j: number): [number, number] {
  return [i / (mesh.cols - 1), j / (mesh.rows - 1)];
}

// Resample an offset grid to a new size (keeps the shape when the user changes cols/rows).
export function resampleOffsets(mesh: Mesh, cols: number, rows: number): [number, number][] {
  const out: [number, number][] = [];
  const src = meshActive({ ...mesh, enabled: true }) ? mesh : null;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      out.push(src ? offsetAt(src, i / (cols - 1), j / (rows - 1)) : [0, 0]);
    }
  }
  return out;
}

function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
}

function at(mesh: Mesh, i: number, j: number, k: 0 | 1): number {
  const ci = Math.min(mesh.cols - 1, Math.max(0, i));
  const cj = Math.min(mesh.rows - 1, Math.max(0, j));
  return mesh.offsets[cj * mesh.cols + ci][k];
}

// Bicubic (Catmull-Rom) sample of the offset grid. Mirrors meshDisp() in warp.ts.
export function offsetAt(mesh: Mesh, u: number, v: number): [number, number] {
  const gx = u * (mesh.cols - 1), gy = v * (mesh.rows - 1);
  const i = Math.floor(gx), j = Math.floor(gy);
  const tx = gx - i, ty = gy - j;
  const out: number[] = [];
  for (const k of [0, 1] as const) {
    const rows: number[] = [];
    for (let r = -1; r <= 2; r++) {
      rows.push(catmull(at(mesh, i - 1, j + r, k), at(mesh, i, j + r, k), at(mesh, i + 1, j + r, k), at(mesh, i + 2, j + r, k), tx));
    }
    out.push(catmull(rows[0], rows[1], rows[2], rows[3], ty));
  }
  return [out[0], out[1]];
}

// Unit square -> output space (0..1, y down), homography plus mesh.
export function warpPoint(slice: Slice, u: number, v: number): [number, number] {
  const p = mapPoint(squareToQuad(slice.corners as [number, number][]), u, v);
  if (!meshActive(slice.mesh)) return p;
  const d = offsetAt(slice.mesh, u, v);
  return [p[0] + d[0], p[1] + d[1]];
}

// Output space -> unit square. Exact for the homography, refined for the mesh.
export function unwarpPoint(slice: Slice, x: number, y: number): [number, number] {
  const inv = invert3(squareToQuad(slice.corners as [number, number][]));
  let uv = mapPoint(inv, x, y);
  if (meshActive(slice.mesh)) {
    // fixed point: each pass converges roughly an order of magnitude (8 is well under a pixel)
    for (let n = 0; n < 8; n++) {
      const d = offsetAt(slice.mesh, uv[0], uv[1]);
      uv = mapPoint(inv, x - d[0], y - d[1]);
    }
  }
  return uv;
}
