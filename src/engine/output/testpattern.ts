// Calibration test pattern: a crosshair grid with the slice name, drawn on a 2D canvas
// and cached as a texture per label. Used instead of the composite while lining a
// projector up, so every slice shows its own name and its own edges.

const SIZE = 1024;
const caches = new WeakMap<WebGL2RenderingContext, Map<string, WebGLTexture>>();

function draw(label: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = SIZE;
  c.height = SIZE;
  const g = c.getContext("2d")!;
  g.fillStyle = "#04060a";
  g.fillRect(0, 0, SIZE, SIZE);
  // grid
  g.strokeStyle = "#1e6f8f";
  g.lineWidth = 2;
  for (let i = 1; i < 8; i++) {
    const p = (i / 8) * SIZE;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, SIZE); g.moveTo(0, p); g.lineTo(SIZE, p); g.stroke();
  }
  // diagonals + inscribed circle
  g.strokeStyle = "#0f4c63";
  g.beginPath(); g.moveTo(0, 0); g.lineTo(SIZE, SIZE); g.moveTo(SIZE, 0); g.lineTo(0, SIZE); g.stroke();
  g.beginPath(); g.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 6, 0, Math.PI * 2); g.stroke();
  // centre crosshair
  g.strokeStyle = "#f472b6";
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(SIZE / 2, SIZE / 2 - 90); g.lineTo(SIZE / 2, SIZE / 2 + 90);
  g.moveTo(SIZE / 2 - 90, SIZE / 2); g.lineTo(SIZE / 2 + 90, SIZE / 2);
  g.stroke();
  // border
  g.strokeStyle = "#38bdf8";
  g.lineWidth = 10;
  g.strokeRect(5, 5, SIZE - 10, SIZE - 10);
  // labels
  g.fillStyle = "#e2e8f0";
  g.font = "bold 84px ui-sans-serif, system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(label, SIZE / 2, SIZE / 2 - 150, SIZE - 120);
  g.font = "bold 44px ui-sans-serif, system-ui, sans-serif";
  g.fillStyle = "#7dd3fc";
  const pad = 40;
  const corners: [string, number, number, CanvasTextAlign, CanvasTextBaseline][] = [
    ["TL", pad, pad, "left", "top"],
    ["TR", SIZE - pad, pad, "right", "top"],
    ["BR", SIZE - pad, SIZE - pad, "right", "bottom"],
    ["BL", pad, SIZE - pad, "left", "bottom"],
  ];
  for (const [t, x, y, a, b] of corners) { g.textAlign = a; g.textBaseline = b; g.fillText(t, x, y); }
  return c;
}

export function testPatternTexture(gl: WebGL2RenderingContext, label: string): WebGLTexture {
  let cache = caches.get(gl);
  if (!cache) { cache = new Map(); caches.set(gl, cache); }
  const hit = cache.get(label);
  if (hit) return hit;
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  // the composite texture is y up, so flip the canvas on upload to match
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, draw(label));
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  cache.set(label, tex);
  return tex;
}
