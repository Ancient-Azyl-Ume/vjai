import { useEffect, useState } from "react";
import { useDoc } from "../../doc/store";
import { listInputDevices } from "../../engine/audio/analyser";
import { agent } from "../../agent/agent";
import { readConfig, writeConfig } from "../shell/config";
import { applyAccent, useSession } from "../shell/session";
import { toast } from "../shell/toast";
import { btn, sel } from "./classes";

const PRESETS: [string, number, number][] = [
  ["1080p", 1920, 1080],
  ["1440p", 2560, 1440],
  ["4K", 3840, 2160],
];

const ACCENTS = ["#22d3ee", "#a78bfa", "#f472b6", "#4ade80", "#fb923c"];
const QUALITY: [string, number][] = [["low", 0.5], ["normal", 1], ["high", 1.5]];

const row = "flex items-center gap-2 py-1";
const field = "bg-neutral-900 border border-neutral-700 rounded px-1.5 py-0.5 w-28";

export function SettingsPanel() {
  const doc = useDoc((s) => s.doc);
  const patch = useDoc((s) => s.patch);
  const set = useDoc((s) => s.set);
  const session = useSession();
  const [devices, setDevices] = useState<{ id: string; label: string }[]>([]);
  const [key, setKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [w, setW] = useState(String(doc.canvas.width));
  const [h, setH] = useState(String(doc.canvas.height));

  useEffect(() => { setW(String(doc.canvas.width)); setH(String(doc.canvas.height)); }, [doc.canvas.width, doc.canvas.height]);
  useEffect(() => { void listInputDevices().then(setDevices); }, []);
  useEffect(() => { void readConfig().then((c) => setHasKey(!!c.apiKey)); }, []);

  const setCanvas = (width: number, height: number) => {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 16 || height < 16) return void toast("canvas size looks wrong", "error");
    void patch([
      { op: "set", path: "canvas.width", value: Math.round(width) },
      { op: "set", path: "canvas.height", value: Math.round(height) },
    ]);
  };

  const saveKey = async () => {
    const k = key.trim();
    if (!k) return;
    await writeConfig({ apiKey: k });
    agent.configure(k);
    setKey("");
    setHasKey(true);
    toast("api key saved", "ok");
  };

  const setAccent = (c: string) => { applyAccent(c); void writeConfig({ accent: c }); };
  const setQuality = (q: number) => { useSession.setState({ previewScale: q }); void writeConfig({ previewScale: q }); };

  return (
    <div className="h-full overflow-auto p-3 text-xs flex flex-col gap-4 max-w-2xl">
      <section>
        <div className="text-neutral-400 mb-1">canvas</div>
        <div className={row}>
          {PRESETS.map(([label, pw, ph]) => (
            <button key={label} className={sel(doc.canvas.width === pw && doc.canvas.height === ph)} onClick={() => setCanvas(pw, ph)}>{label}</button>
          ))}
          <span className="text-neutral-600">custom</span>
          <input className={field} value={w} onChange={(e) => setW(e.target.value)} />
          <span className="text-neutral-600">x</span>
          <input className={field} value={h} onChange={(e) => setH(e.target.value)} />
          <button className={btn} onClick={() => setCanvas(Number(w), Number(h))}>apply</button>
        </div>
        <div className="text-neutral-600">every layer, effect and slice is measured on this canvas.</div>
      </section>

      <section>
        <div className="text-neutral-400 mb-1">audio input</div>
        <div className={row}>
          <select className="bg-neutral-900 border border-neutral-700 rounded px-1.5 py-0.5" value={doc.audio.deviceId} onChange={(e) => set("audio.deviceId", e.target.value)}>
            <option value="">system default</option>
            {devices.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
          <button className={btn} onClick={() => void listInputDevices().then(setDevices)}>refresh</button>
        </div>
        <div className="text-neutral-600">device names appear once audio input has been started once (browser permission).</div>
      </section>

      <section>
        <div className="text-neutral-400 mb-1">chat agent</div>
        <div className={row}>
          <input className="bg-neutral-900 border border-neutral-700 rounded px-1.5 py-0.5 w-80" type="password" placeholder={hasKey ? "api key stored - paste a new one to replace" : "anthropic api key"} value={key} onChange={(e) => setKey(e.target.value)} />
          <button className={btn} onClick={saveKey}>save</button>
        </div>
      </section>

      <section>
        <div className="text-neutral-400 mb-1">appearance</div>
        <div className={row}>
          <span className="text-neutral-600 w-20">accent</span>
          {ACCENTS.map((c) => (
            <button key={c} className={`w-5 h-5 rounded border ${session.accent === c ? "border-white" : "border-neutral-700"}`} style={{ background: c }} onClick={() => setAccent(c)} />
          ))}
          <input type="color" className="w-8 h-5 bg-transparent" value={session.accent} onChange={(e) => setAccent(e.target.value)} />
        </div>
        <div className={row}>
          <span className="text-neutral-600 w-20">preview</span>
          {QUALITY.map(([label, q]) => (
            <button key={label} className={sel(session.previewScale === q)} onClick={() => setQuality(q)}>{label}</button>
          ))}
          <span className="text-neutral-600">render scale of the preview panel only, outputs are always full quality.</span>
        </div>
      </section>
    </div>
  );
}
