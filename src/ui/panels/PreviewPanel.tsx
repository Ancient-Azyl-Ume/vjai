import { useEffect, useId, useRef, useState } from "react";
import { call } from "../../rpc";
import { useDoc } from "../../doc/store";
import type { Engine, ViewMode } from "../../engine/core/engine";
import { getEngine } from "../hooks/useEngine";
import { useUi } from "../shell/uiStore";
import { useSession } from "../shell/session";
import { toast } from "../shell/toast";
import { btn, sel } from "./classes";

const METERS = ["rms", "bass", "mid", "high", "kick"] as const;

// The preview owns its canvas sizing (instead of useEngineCanvas) because the render
// scale, the fit/1:1 zoom and the safe frame all key off the same measurement.
export function PreviewPanel() {
  const doc = useDoc((s) => s.doc);
  const ready = useDoc((s) => s.ready);
  const previewScale = useSession((s) => s.previewScale);
  const audioOn = useUi((s) => s.audioOn);
  const [mode, setMode] = useState<ViewMode>({ kind: "composite" });
  const [fit, setFit] = useState(true);
  const [safe, setSafe] = useState(false);
  const [monitors, setMonitors] = useState<{ index: number; width: number; height: number }[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const meters = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const viewId = useId();

  useEffect(() => { void call<{ index: number; width: number; height: number }[]>("list_monitors").then(setMonitors).catch(() => {}); }, []);

  // an output preview has the projector's aspect, the composite has the canvas aspect
  const output = mode.kind === "output" ? doc.outputs.find((o) => o.id === mode.id) : undefined;
  const mon = output ? monitors[output.monitor] : undefined;
  const aspect = mon ? mon.width / mon.height : doc.canvas.width / doc.canvas.height;
  const vw = doc.canvas.width;
  const vh = Math.round(vw / aspect);
  const modeKey = mode.kind === "composite" ? "composite" : `output:${mode.id}`;

  useEffect(() => {
    if (!ready || !canvas.current || !box.current) return;
    const eng = getEngine();
    engineRef.current = eng;
    const c = canvas.current, b = box.current;
    const resize = () => {
      const r = b.getBoundingClientRect();
      const s = fit ? Math.min(r.width / vw, r.height / vh) : 1;
      c.style.width = `${vw * s}px`;
      c.style.height = `${vh * s}px`;
      c.width = Math.max(1, Math.round(vw * s * devicePixelRatio * previewScale));
      c.height = Math.max(1, Math.round(vh * s * devicePixelRatio * previewScale));
    };
    resize();
    eng.addView(viewId, c, mode);
    const ro = new ResizeObserver(resize);
    ro.observe(b);
    return () => { ro.disconnect(); eng.removeView(viewId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, modeKey, fit, previewScale, vw, vh]);

  useEffect(() => {
    // meter widths are written straight to the DOM: no React re-render per tick
    const id = setInterval(() => {
      const e = engineRef.current, m = meters.current;
      if (!e || !m) return;
      for (const k of METERS) {
        const bar = m.querySelector<HTMLDivElement>(`[data-k="${k}"]`);
        if (bar) bar.style.width = `${(e.audio.signals[k] ?? 0) * 100}%`;
      }
    }, 50);
    return () => clearInterval(id);
  }, []);

  const startAudio = async () => {
    const a = engineRef.current?.audio;
    if (!a) return;
    // "audio live" follows the analyser, never the mere fact that start() resolved
    await a.start(doc.audio.deviceId || undefined);
    useUi.getState().set({ audioOn: a.running });
    if (!a.running) toast(`audio input: ${a.error}`, "error");
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-1 px-2 py-1 border-b border-neutral-800 text-[11px]">
        <button className={sel(mode.kind === "composite")} onClick={() => setMode({ kind: "composite" })}>composite</button>
        {doc.outputs.map((o) => (
          <button key={o.id} className={sel(mode.kind === "output" && mode.id === o.id)} onClick={() => setMode({ kind: "output", id: o.id })}>{o.name}</button>
        ))}
        <span className="flex-1" />
        <button className={sel(safe)} onClick={() => setSafe((v) => !v)} title="90% safe frame">safe</button>
        <button className={btn} onClick={() => setFit((v) => !v)} title="fit to panel or 1:1 pixels">{fit ? "fit" : "1:1"}</button>
        <span className="text-neutral-600 tabular-nums">{vw}x{vh}{previewScale !== 1 ? ` @${previewScale}x` : ""}</span>
      </div>
      <div ref={box} className="flex-1 flex items-center justify-center bg-black min-h-0 p-1 overflow-auto">
        <div className="relative shrink-0">
          <canvas ref={canvas} className="block" />
          {safe && <div className="absolute inset-[5%] border border-dashed pointer-events-none" style={{ borderColor: "var(--accent)" }} />}
          {doc.blackout && mode.kind === "output" && (
            <div className="absolute inset-0 bg-black flex items-center justify-center text-rose-500 text-xs tracking-widest">BLACKOUT</div>
          )}
        </div>
      </div>
      <div ref={meters} className="flex items-center gap-3 px-2 py-1 border-t border-neutral-800 text-[11px]">
        {!audioOn ? <button className={btn} onClick={startAudio}>audio in</button> : <span className="text-emerald-400">audio live</span>}
        {METERS.map((k) => (
          <div key={k} className="flex items-center gap-1 w-24">
            <span className="w-8 text-neutral-400">{k}</span>
            <div className="flex-1 h-2 bg-neutral-800 rounded overflow-hidden"><div data-k={k} className="h-full bg-emerald-500" style={{ width: 0 }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
