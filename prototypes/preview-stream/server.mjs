// Preview stream server: pushes JPEG frames over WebSocket at a chosen size and fps.
// Frame wire format: [4-byte BE header length][JSON header][JPEG bytes].
// Header: { n, ts, cmd, w, h } - ts is server Date.now(), cmd echoes the last control id.
// Usage: node server.mjs --w 320 --h 180 --fps 5 --streams 1 --delay 0 --port 8791
import { createServer } from "node:http";
import { readFileSync, readdirSync } from "node:fs";
import { WebSocketServer } from "ws";

const arg = (k, d) => {
  const i = process.argv.indexOf("--" + k);
  return i > 0 ? Number(process.argv[i + 1]) : d;
};
const W = arg("w", 320), H = arg("h", 180), FPS = arg("fps", 5);
const STREAMS = arg("streams", 1), DELAY = arg("delay", 0), PORT = arg("port", 8791);

// Frame source: node-canvas if installed, else the pre-rendered ffmpeg JPEGs.
let frames = null, drawFrame = null;
try {
  const { createCanvas } = await import("canvas");
  const c = createCanvas(W, H), g = c.getContext("2d");
  drawFrame = (n) => {
    const t = n / FPS;
    g.fillStyle = "#101018"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#3fd";
    g.fillRect((Math.sin(t) * 0.4 + 0.5) * W - 20, (Math.cos(t * 0.7) * 0.4 + 0.5) * H - 20, 40, 40);
    g.fillStyle = "#fff"; g.font = "16px sans-serif"; g.fillText(String(n), 8, 20);
    return c.toBuffer("image/jpeg", { quality: 0.6 });
  };
  console.log("SRC canvas");
} catch {
  const dir = `frames/${W}x${H}`;
  frames = readdirSync(new URL(dir + "/", import.meta.url)).sort()
    .map((f) => readFileSync(new URL(`${dir}/${f}`, import.meta.url)));
  console.log(`SRC ffmpeg ${dir} ${frames.length} frames`);
}

const page = readFileSync(new URL("client.html", import.meta.url));
const http = createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html" });
  res.end(page);
});
const wss = new WebSocketServer({ server: http });

// One client watches one output stream: ws://host/?s=<index>.
const clients = new Set();
let lastCmd = 0, sentBytes = 0, sentFrames = 0;
wss.on("connection", (ws, req) => {
  ws.stream = Number(new URL(req.url, "http://x").searchParams.get("s") || 0);
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
  ws.on("message", (m) => {
    try {
      const o = JSON.parse(m);
      if (o.t === "cmd") lastCmd = o.id; // control action, echoed in the next frame header
    } catch {}
  });
});

// One timer per output stream. All streams share the same JPEG buffers.
const step = Math.max(1, Math.round(15 / FPS)); // sources are 15 fps, keep motion real-time
for (let s = 0; s < STREAMS; s++) {
  let n = 0;
  setInterval(() => {
    const jpeg = frames ? frames[(n * step) % frames.length] : drawFrame(n);
    n++;
    const head = Buffer.from(JSON.stringify({ n, s, ts: Date.now(), cmd: lastCmd, w: W, h: H }));
    const len = Buffer.alloc(4); len.writeUInt32BE(head.length);
    const msg = Buffer.concat([len, head, jpeg]);
    const send = () => {
      for (const ws of clients) if (ws.readyState === 1 && ws.stream === s) { ws.send(msg); sentBytes += msg.length; sentFrames++; }
    };
    if (DELAY > 0) setTimeout(send, DELAY); else send();
  }, 1000 / FPS);
}

// CPU + bandwidth line once a second, for the bench harness.
let lastCpu = process.cpuUsage(), lastT = Date.now(), lastB = 0, lastF = 0;
setInterval(() => {
  const cpu = process.cpuUsage(), t = Date.now();
  const used = (cpu.user - lastCpu.user + cpu.system - lastCpu.system) / 1000;
  const pct = (used / (t - lastT)) * 100;
  console.log("STATS " + JSON.stringify({
    cpu: +pct.toFixed(2),
    kBs: +((sentBytes - lastB) / (t - lastT)).toFixed(2),
    fps: +(((sentFrames - lastF) * 1000) / (t - lastT)).toFixed(2),
    clients: clients.size,
  }));
  lastCpu = cpu; lastT = t; lastB = sentBytes; lastF = sentFrames;
}, 1000);

http.listen(PORT, () => console.log(`READY http://localhost:${PORT} ${W}x${H}@${FPS} streams=${STREAMS} delay=${DELAY}ms`));
