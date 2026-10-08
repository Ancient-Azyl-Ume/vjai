// Runs the configs, one server process each, with a headless WS client per stream.
// Prints one row per config: bandwidth, server CPU, browser-side jitter, latency, cmd-to-glass.
import { spawn } from "node:child_process";
import { WebSocket } from "ws";

const CONFIGS = [
  { name: "320x180 @5", w: 320, h: 180, fps: 5, streams: 1, delay: 0 },
  { name: "320x180 @15", w: 320, h: 180, fps: 15, streams: 1, delay: 0 },
  { name: "640x360 @10", w: 640, h: 360, fps: 10, streams: 1, delay: 0 },
  { name: "320x180 @5 +80ms", w: 320, h: 180, fps: 5, streams: 1, delay: 80 },
  { name: "320x180 @5 +200ms", w: 320, h: 180, fps: 5, streams: 1, delay: 200 },
  { name: "320x180 @5 x3", w: 320, h: 180, fps: 5, streams: 3, delay: 0 },
];
const PORT = 8792, WARMUP = 3000, RUN = 20000;
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);

async function run(c) {
  const srv = spawn("node", ["server.mjs", "--w", c.w, "--h", c.h, "--fps", c.fps,
    "--streams", c.streams, "--delay", c.delay, "--port", PORT],
    { cwd: new URL(".", import.meta.url).pathname });
  const cpu = [];
  srv.stdout.on("data", (d) => {
    for (const line of String(d).split("\n")) if (line.startsWith("STATS ")) cpu.push(JSON.parse(line.slice(6)));
  });
  await new Promise((r) => setTimeout(r, 800));

  // One client per output stream, mirroring three phones or three panels.
  const clients = [];
  for (let i = 0; i < c.streams; i++) {
    const ws = new WebSocket(`ws://localhost:${PORT}/?s=${i}`);
    const st = { arrivals: [], sizes: [], lats: [], glass: [], cmdId: 0, cmdAt: 0, on: false };
    ws.on("message", (buf) => {
      const hlen = buf.readUInt32BE(0);
      const head = JSON.parse(buf.subarray(4, 4 + hlen));
      if (!st.on) return;
      st.arrivals.push(performance.now());
      st.sizes.push(buf.length);
      st.lats.push(Date.now() - head.ts); // same machine: one clock
      if (st.cmdId && head.cmd === st.cmdId) { st.glass.push(performance.now() - st.cmdAt); st.cmdId = 0; }
    });
    clients.push({ ws, st });
  }
  await new Promise((r) => setTimeout(r, WARMUP));
  for (const { st } of clients) st.on = true;
  const c0 = cpu.length;

  // Fire a control action every 2 s on the first client to get command-to-glass.
  const cmdTimer = setInterval(() => {
    const { ws, st } = clients[0];
    st.cmdId = Date.now(); st.cmdAt = performance.now();
    ws.send(JSON.stringify({ t: "cmd", id: st.cmdId }));
  }, 2000);

  await new Promise((r) => setTimeout(r, RUN));
  clearInterval(cmdTimer);
  for (const { ws } of clients) ws.close();
  srv.kill();

  const all = clients.map(({ st }) => st);
  const gaps = all.flatMap((s) => s.arrivals.slice(1).map((v, i) => v - s.arrivals[i]));
  const g = mean(gaps);
  const jit = Math.sqrt(mean(gaps.map((x) => (x - g) ** 2)));
  const secs = mean(all.map((s) => (s.arrivals.at(-1) - s.arrivals[0]) / 1000));
  const kBs = all.reduce((a, s) => a + s.sizes.reduce((x, y) => x + y, 0), 0) / 1024 / secs;
  const cpuRun = cpu.slice(c0).map((x) => x.cpu);
  return {
    name: c.name,
    fps: +(1000 / g).toFixed(2),
    frameKB: +(mean(all.flatMap((s) => s.sizes)) / 1024).toFixed(1),
    kBs: +kBs.toFixed(1),
    latMs: +mean(all.flatMap((s) => s.lats)).toFixed(1),
    jitterMs: +jit.toFixed(1),
    worstGapMs: +Math.max(...gaps).toFixed(0),
    cpuPct: +mean(cpuRun).toFixed(1),
    cpuMaxPct: +Math.max(...cpuRun).toFixed(1),
    cmdGlassMs: +mean(all.flatMap((s) => s.glass)).toFixed(0),
  };
}

const rows = [];
for (const c of CONFIGS) { const r = await run(c); rows.push(r); console.error("done", r.name); }
console.log(JSON.stringify(rows, null, 2));
console.log(["config", "fps", "kB/frame", "kB/s", "latency ms", "jitter ms", "worst gap ms", "cpu %", "cpu max %", "cmd-to-glass ms"].join("\t"));
for (const r of rows) console.log([r.name, r.fps, r.frameKB, r.kBs, r.latMs, r.jitterMs, r.worstGapMs, r.cpuPct, r.cpuMaxPct, r.cmdGlassMs].join("\t"));
