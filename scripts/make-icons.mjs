// Generates the whole src-tauri/icons set from code: no binary assets in the repo,
// no downloads. Run with: node scripts/make-icons.mjs
// The mark is a projector: a lens on the left throwing a three-beam cone to the right.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src-tauri", "icons");

// ---- png ----
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // rgba
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- the mark ----
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const INK = [10, 10, 14];
const EDGE = [30, 30, 40];
const MAGENTA = [255, 46, 136];
const CYAN = [34, 211, 238];

// signed distance to a rounded rectangle, negative inside
function sdRoundRect(x, y, cx, cy, hw, hh, r) {
  const qx = Math.abs(x - cx) - (hw - r);
  const qy = Math.abs(y - cy) - (hh - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

// colour of one sample in unit space (0..1, y down); returns [r,g,b,a] 0..255
function sample(x, y) {
  let col = [0, 0, 0];
  let a = 0;
  // body
  if (sdRoundRect(x, y, 0.5, 0.5, 0.45, 0.45, 0.105) < 0) {
    col = mix(INK, EDGE, clamp(y * 0.9));
    a = 255;
  }
  if (a === 0) return [0, 0, 0, 0];

  const ax = 0.3, ay = 0.5; // beam apex (lens centre)
  const dx = x - ax, dy = y - ay;
  const ang = Math.atan2(dy, dx);
  const SPREAD = 0.42;
  if (dx > 0 && x < 0.9 && Math.abs(ang) < SPREAD) {
    // three beams: two thin gaps cut the cone
    const gap = Math.abs(Math.abs(ang) - 0.15) < 0.022;
    if (!gap) {
      const t = clamp((x - ax) / 0.6);
      const beam = mix(MAGENTA, CYAN, t);
      const soft = 1 - Math.pow(Math.abs(ang) / SPREAD, 3); // soft cone edges
      const fade = 0.95 - 0.35 * t;
      col = mix(col, beam, clamp(soft * fade));
    }
  }
  // lens
  const dl = Math.hypot(x - ax, y - ay);
  if (dl < 0.115) col = mix(col, [245, 247, 255], clamp((0.115 - dl) * 40));
  else if (dl < 0.145) col = mix(col, CYAN, clamp((0.145 - dl) * 20) * 0.7);
  return [Math.round(col[0]), Math.round(col[1]), Math.round(col[2]), a];
}

const cache = new Map();
function render(size) {
  if (cache.has(size)) return cache.get(size);
  const SS = 3; // supersampling
  const buf = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const s = sample((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size);
          r += s[0] * s[3]; g += s[1] * s[3]; b += s[2] * s[3]; a += s[3];
        }
      }
      const i = (py * size + px) * 4;
      buf[i] = a ? Math.round(r / a) : 0;
      buf[i + 1] = a ? Math.round(g / a) : 0;
      buf[i + 2] = a ? Math.round(b / a) : 0;
      buf[i + 3] = Math.round(a / (SS * SS));
    }
  }
  const out = png(size, size, buf);
  cache.set(size, out);
  return out;
}

// ---- containers ----
function icns(entries) {
  const parts = [];
  for (const [type, data] of entries) {
    const head = Buffer.alloc(8);
    head.write(type, 0, "ascii");
    head.writeUInt32BE(data.length + 8, 4);
    parts.push(head, data);
  }
  const body = Buffer.concat(parts);
  const head = Buffer.alloc(8);
  head.write("icns", 0, "ascii");
  head.writeUInt32BE(body.length + 8, 4);
  return Buffer.concat([head, body]);
}

// Vista-style ICO: every entry is a PNG.
function ico(sizes) {
  const imgs = sizes.map((s) => render(s));
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(sizes.length, 4);
  let offset = 6 + 16 * sizes.length;
  const dir = [];
  for (let i = 0; i < sizes.length; i++) {
    const e = Buffer.alloc(16);
    e[0] = sizes[i] >= 256 ? 0 : sizes[i];
    e[1] = sizes[i] >= 256 ? 0 : sizes[i];
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(imgs[i].length, 8);
    e.writeUInt32LE(offset, 12);
    offset += imgs[i].length;
    dir.push(e);
  }
  return Buffer.concat([head, ...dir, ...imgs]);
}

mkdirSync(OUT, { recursive: true });
const write = (name, buf) => { writeFileSync(join(OUT, name), buf); console.log(name, buf.length); };

for (const [name, size] of [
  ["32x32.png", 32],
  ["128x128.png", 128],
  ["128x128@2x.png", 256],
  ["icon.png", 1024],
  ["StoreLogo.png", 50],
  ["Square30x30Logo.png", 30],
  ["Square44x44Logo.png", 44],
  ["Square71x71Logo.png", 71],
  ["Square89x89Logo.png", 89],
  ["Square107x107Logo.png", 107],
  ["Square142x142Logo.png", 142],
  ["Square150x150Logo.png", 150],
  ["Square284x284Logo.png", 284],
  ["Square310x310Logo.png", 310],
]) write(name, render(size));

write("icon.icns", icns([
  ["icp4", render(16)],
  ["icp5", render(32)],
  ["icp6", render(64)],
  ["ic07", render(128)],
  ["ic08", render(256)],
  ["ic09", render(512)],
  ["ic10", render(1024)],
  ["ic11", render(32)],
  ["ic12", render(64)],
  ["ic13", render(256)],
  ["ic14", render(512)],
]));
write("icon.ico", ico([16, 32, 48, 64, 128, 256]));
