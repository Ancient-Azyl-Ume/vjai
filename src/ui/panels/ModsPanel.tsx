import { useEffect, useMemo, useRef, useState } from "react";
import { useDoc, type Op } from "../../doc/store";
import { EnvInputs, LfoShapes, ModSources, uid, type Doc, type Mod } from "../../doc/schema";
import { EFFECTS } from "../../engine/effects";
import { SIGNAL_NAMES, listInputDevices, type SignalName } from "../../engine/audio/analyser";
import { readRing, type Ring } from "../../engine/audio/ring";
import { getEngine } from "../hooks/useEngine";
import { armAssign, useAssignTarget } from "../hooks/useAssignTarget";
import { useUi } from "../shell/uiStore";
import { toast } from "../shell/toast";
import { btn } from "./classes";

// The modulation matrix: audio in and tempo on top, a scope per signal, the macro
// knobs, then one row per mod with a live scope of its source and its mapped output.

// One rAF loop drives every scope on the panel; each Scope registers its draw call.
const scopeDraws = new Set<() => void>();

export function ModsPanel() {
  const doc = useDoc((s) => s.doc);
  const patch = useDoc((s) => s.patch);
  const targets = useMemo(() => collectTargets(doc), [doc]);
  const assign = useAssignTarget();

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last < 33) return;
      last = t;
      for (const f of scopeDraws) f();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") armAssign(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Defaults that do something the moment the row appears: the beat clock free-runs at
  // the doc bpm even with no audio, and a negative amount pulls the target down from its
  // base (most bases - opacity, scale - sit at the top of their range, so +1 just clamps).
  const addMod = () =>
    patch([
      {
        op: "add",
        path: "mods",
        value: { id: uid("m"), enabled: true, source: "beat", sourceId: "", target: targets[0] ?? "", amount: -1, smooth: 0.35, curve: 1, rate: 1, shape: "sine", sync: false, rateBeats: 1, offset: 0, envInput: "rms", attack: 5, release: 200, min: 0, max: 1, bipolar: false, invert: false, hold: false },
      },
    ]);

  return (
    <div className="h-full flex flex-col text-[11px] select-none">
      <AudioBar />
      <SignalStrip />
      <MacroRow />
      {assign.armed && (
        <div className="px-2 py-1 bg-sky-900/40 border-b border-sky-800 text-sky-200">
          touch any parameter in any panel to assign it (esc to cancel)
        </div>
      )}
      <div className="flex-1 overflow-auto">
        {doc.mods.map((m) => (
          <ModRow key={m.id} mod={m} doc={doc} targets={targets} />
        ))}
        <div className="p-1">
          <button className={btn} onClick={addMod}>+ modulation</button>
        </div>
      </div>
    </div>
  );
}

// ----- audio + tempo -----

function AudioBar() {
  const doc = useDoc((s) => s.doc);
  const set = useDoc((s) => s.set);
  const patch = useDoc((s) => s.patch);
  const [devices, setDevices] = useState<{ id: string; label: string }[]>([]);
  // the analyser is the truth about capture: a failed start must not read as "live"
  const [audio, setAudio] = useState({ running: false, error: "" });
  const readout = useRef<HTMLSpanElement>(null);

  const refresh = () => void listInputDevices().then(setDevices);
  useEffect(refresh, []);

  useEffect(() => {
    const id = setInterval(() => {
      const a = getEngine().audio;
      setAudio((p) => (p.running === a.running && p.error === a.error ? p : { running: a.running, error: a.error }));
      // keep the top-bar indicator honest even if capture drops or a device switch fails
      if (useUi.getState().audioOn !== a.running) useUi.getState().set({ audioOn: a.running });
      const e = readout.current;
      if (e) e.textContent = `${a.bpm.toFixed(1)} bpm · conf ${(a.confidence * 100).toFixed(0)}%`;
    }, 100);
    return () => clearInterval(id);
  }, []);

  const start = async () => {
    const a = getEngine().audio;
    const ok = await a.start(doc.audio.deviceId || undefined);
    useUi.getState().set({ audioOn: a.running });
    setAudio({ running: a.running, error: a.error });
    if (!ok) toast(`audio input: ${a.error}`, "error");
    refresh();
  };
  const stop = () => {
    const a = getEngine().audio;
    a.stop();
    useUi.getState().set({ audioOn: false });
    setAudio({ running: false, error: "" });
  };
  const tap = () => {
    const bpm = getEngine().audio.tap();
    if (bpm) patch([{ op: "set", path: "audio.bpm", value: Math.round(bpm * 10) / 10 }, { op: "set", path: "audio.bpmLock", value: true }]);
  };

  return (
    <div className="flex items-center gap-2 px-2 py-1 border-b border-neutral-800 flex-wrap">
      {audio.running ? (
        <button className={btn + " text-emerald-400"} onClick={stop} title="stop capture">audio live</button>
      ) : (
        <button className={btn} onClick={start}>{audio.error ? "retry audio in" : "audio in"}</button>
      )}
      {!audio.running && audio.error && (
        <span className="text-rose-400 max-w-56 truncate" title={audio.error}>no mic: {audio.error}</span>
      )}
      <select
        className="bg-neutral-900 border border-neutral-700 rounded px-1 py-0.5 max-w-44"
        value={doc.audio.deviceId}
        onChange={(e) => set("audio.deviceId", e.target.value)}
        onFocus={refresh}
      >
        <option value="">default input</option>
        {devices.map((d) => (
          <option key={d.id} value={d.id}>{d.label}</option>
        ))}
      </select>
      <Num label="gain" value={doc.audio.gain} min={0} max={8} step={0.05} onChange={(v) => set("audio.gain", v)} />
      <Num label="sens" value={doc.audio.kickThreshold} min={0.5} max={4} step={0.05} onChange={(v) => set("audio.kickThreshold", v)} />
      <span className="w-px h-4 bg-neutral-800" />
      <button className={btn} onClick={tap}>tap</button>
      <Num label="bpm" value={doc.audio.bpm} min={40} max={240} step={0.5} onChange={(v) => set("audio.bpm", v)} width={70} box />
      <Chk label="lock" value={doc.audio.bpmLock} onChange={(v) => set("audio.bpmLock", v)} />
      <span ref={readout} className="text-neutral-400 tabular-nums" />
      <Scope w={90} h={18} draw={(c, w, h) => { fill(c, w, h); trace(c, w, h, getEngine().audio.history.phase, 0, 1, "#38bdf8"); }} />
    </div>
  );
}

function SignalStrip() {
  return (
    <div className="flex gap-2 px-2 py-1 border-b border-neutral-800 overflow-x-auto">
      {SIGNAL_NAMES.map((k) => (
        <div key={k} className="shrink-0">
          <div className="text-neutral-500">{k}</div>
          <Scope w={62} h={22} draw={(c, w, h) => { fill(c, w, h); trace(c, w, h, getEngine().audio.history[k as SignalName], 0, 1, "#34d399"); }} />
        </div>
      ))}
    </div>
  );
}

// ----- macros -----

function MacroRow() {
  const doc = useDoc((s) => s.doc);
  const set = useDoc((s) => s.set);
  const patch = useDoc((s) => s.patch);
  const add = () => patch([{ op: "add", path: "macros", value: { id: uid("mc"), name: `macro ${doc.macros.length + 1}`, value: 0.5 } }]);
  // Mods driven BY the macro lose their source here; mods that TARGET it are dropped by the
  // store's dangling-mod cleanup, in the same patch.
  const remove = (id: string) => {
    const ops: Op[] = [{ op: "remove", path: `macros.${id}` }];
    for (const m of doc.mods) {
      if (m.source === "macro" && m.sourceId === id) {
        ops.push({ op: "set", path: `mods.${m.id}.sourceId`, value: "" }, { op: "set", path: `mods.${m.id}.enabled`, value: false });
      }
    }
    void patch(ops);
  };
  return (
    <div className="flex items-end gap-3 px-2 py-1 border-b border-neutral-800 overflow-x-auto">
      {doc.macros.map((mc) => (
        <div key={mc.id} className="shrink-0 w-28">
          <div className="flex items-center gap-1">
            <input
              className="bg-transparent border-b border-neutral-800 w-full outline-none focus:border-neutral-600"
              value={mc.name}
              onChange={(e) => set(`macros.${mc.id}.name`, e.target.value)}
            />
            <button className="text-neutral-600 hover:text-red-400" onClick={() => remove(mc.id)}>x</button>
          </div>
          <input
            type="range"
            className="w-full accent-sky-500"
            min={0}
            max={1}
            step={0.001}
            value={mc.value}
            onChange={(e) => set(`macros.${mc.id}.value`, Number(e.target.value))}
          />
          <Scope w={112} h={14} draw={(c, w, h) => { fill(c, w, h); bar(c, w, h, live(`macros.${mc.id}.value`, mc.value), "#a78bfa"); }} />
        </div>
      ))}
      <button className={btn} onClick={add}>+ macro</button>
    </div>
  );
}

// ----- one modulation -----

function ModRow({ mod, doc, targets }: { mod: Mod; doc: Doc; targets: string[] }) {
  const set = useDoc((s) => s.set);
  const patch = useDoc((s) => s.patch);
  const assign = useAssignTarget();
  const [open, setOpen] = useState(false);
  const base = `mods.${mod.id}`;
  const [lo, hi] = mappedRange(mod);
  const armed = assign.armed === mod.id;
  const known = targets.includes(mod.target);

  return (
    <div className={`border-b border-neutral-900 px-2 py-1 ${armed ? "bg-sky-950/40" : ""}`}>
      <div className="flex items-center gap-1.5 flex-wrap">
        <input type="checkbox" checked={mod.enabled} onChange={(e) => set(`${base}.enabled`, e.target.checked)} />
        <Sel value={mod.source} options={ModSources} onChange={(v) => set(`${base}.source`, v)} />
        {mod.source === "macro" && (
          <Sel
            value={mod.sourceId}
            options={doc.macros.map((m) => m.id)}
            labels={Object.fromEntries(doc.macros.map((m) => [m.id, m.name]))}
            onChange={(v) => set(`${base}.sourceId`, v)}
          />
        )}
        <span className="text-neutral-600">-&gt;</span>
        <select
          className="bg-neutral-900 border border-neutral-700 rounded px-1 py-0.5 max-w-64"
          value={known ? mod.target : ""}
          onChange={(e) => set(`${base}.target`, e.target.value)}
        >
          {/* the empty slot names the unresolved target, if any; the list below is labelled */}
          <option value="">{known ? "(no target)" : mod.target || "(no target)"}</option>
          {targets.map((t) => (
            <option key={t} value={t}>{targetLabel(doc, t)}</option>
          ))}
        </select>
        <button className={btn + (armed ? " ring-1 ring-sky-500" : "")} onClick={() => assign.arm(armed ? null : mod.id)} title="pick the target by clicking a parameter">
          {armed ? "picking..." : "assign"}
        </button>
        <Num label="amt" value={mod.amount} min={-4} max={4} step={0.01} onChange={(v) => set(`${base}.amount`, v)} />
        <Scope
          w={120}
          h={26}
          draw={(c, w, h) => {
            fill(c, w, h);
            const hist = getEngine().mods.history.get(mod.id);
            if (!hist) return;
            zero(c, w, h, lo, hi);
            trace(c, w, h, hist.raw, 0, 1, "#3f6212");
            trace(c, w, h, hist.out, lo, hi, "#a3e635");
          }}
        />
        <button className="text-neutral-500 hover:text-white px-1" onClick={() => setOpen(!open)}>{open ? "-" : "..."}</button>
        <button className="text-neutral-600 hover:text-red-400 px-1" onClick={() => patch([{ op: "remove", path: base }])}>x</button>
      </div>
      {open && (
        <div className="flex items-center gap-3 flex-wrap pl-6 py-1 text-neutral-400">
          <Num label="min" value={mod.min} min={-4} max={4} step={0.01} onChange={(v) => set(`${base}.min`, v)} />
          <Num label="max" value={mod.max} min={-4} max={4} step={0.01} onChange={(v) => set(`${base}.max`, v)} />
          <Num label="curve" value={mod.curve} min={0.1} max={5} step={0.01} onChange={(v) => set(`${base}.curve`, v)} />
          {/* an lfo is its own envelope: the release knob would only round its shape off */}
          {mod.source !== "lfo" && <Num label="smooth" value={mod.smooth} min={0} max={0.99} step={0.01} onChange={(v) => set(`${base}.smooth`, v)} />}
          <Chk label="bipolar" value={mod.bipolar} onChange={(v) => set(`${base}.bipolar`, v)} />
          <Chk label="invert" value={mod.invert} onChange={(v) => set(`${base}.invert`, v)} />
          <Chk label="hold" value={mod.hold} onChange={(v) => set(`${base}.hold`, v)} />
          {mod.source === "lfo" && (
            <>
              <Sel value={mod.shape} options={LfoShapes} onChange={(v) => set(`${base}.shape`, v)} />
              <Chk label="sync" value={mod.sync} onChange={(v) => set(`${base}.sync`, v)} />
              {mod.sync ? (
                <Num label="beats" value={mod.rateBeats} min={0.0625} max={16} step={0.0625} onChange={(v) => set(`${base}.rateBeats`, v)} />
              ) : (
                <Num label="hz" value={mod.rate} min={0.01} max={20} step={0.01} onChange={(v) => set(`${base}.rate`, v)} />
              )}
              <Num label="phase" value={mod.offset} min={0} max={1} step={0.01} onChange={(v) => set(`${base}.offset`, v)} />
            </>
          )}
          {mod.source === "env" && (
            <>
              <Sel value={mod.envInput} options={EnvInputs} onChange={(v) => set(`${base}.envInput`, v)} />
              <Num label="atk ms" value={mod.attack} min={0} max={500} step={1} onChange={(v) => set(`${base}.attack`, v)} />
              <Num label="rel ms" value={mod.release} min={1} max={2000} step={1} onChange={(v) => set(`${base}.release`, v)} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ----- small controls -----

// `box`: the readout becomes a typable field (the bpm needs one; fmt() would round it away).
function Num({ label, value, min, max, step, onChange, width = 56, box = false }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; width?: number; box?: boolean }) {
  return (
    <label className="flex items-center gap-1">
      <span className="text-neutral-500">{label}</span>
      <input type="range" className="accent-sky-500" style={{ width }} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {box ? <NumBox value={value} min={min} max={max} step={step} onChange={onChange} /> : <span className="tabular-nums text-neutral-400 w-10">{fmt(value)}</span>}
    </label>
  );
}

// Typed digits are held as text until Enter or blur, so half-typed numbers are not clamped.
function NumBox({ value, min, max, step, onChange }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  const [text, setText] = useState<string | null>(null);
  const commit = (s: string) => {
    setText(null);
    const v = Number(s);
    if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
  };
  return (
    <input
      type="number"
      step={step}
      className="bg-neutral-900 border border-neutral-700 rounded px-1 w-20 tabular-nums text-neutral-300 outline-none focus:border-sky-700"
      value={text ?? String(Math.round(value * 100) / 100)}
      onChange={(e) => setText(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") { setText(null); e.currentTarget.blur(); }
      }}
    />
  );
}

function Chk({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-neutral-500">{label}</span>
    </label>
  );
}

function Sel({ value, options, labels, onChange }: { value: string; options: readonly string[]; labels?: Record<string, string>; onChange: (v: string) => void }) {
  return (
    <select className="bg-neutral-900 border border-neutral-700 rounded px-1 py-0.5" value={value} onChange={(e) => onChange(e.target.value)}>
      {!options.includes(value) && <option value={value}>{value || "-"}</option>}
      {options.map((o) => (
        <option key={o} value={o}>{labels?.[o] ?? o}</option>
      ))}
    </select>
  );
}

function Scope({ w, h, draw }: { w: number; h: number; draw: (c: CanvasRenderingContext2D, w: number, h: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  useEffect(() => {
    const fn = () => {
      const c = ref.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const dpr = devicePixelRatio || 1;
      if (c.width !== w * dpr || c.height !== h * dpr) {
        c.width = w * dpr;
        c.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawRef.current(ctx, w, h);
    };
    scopeDraws.add(fn);
    return () => {
      scopeDraws.delete(fn);
    };
  }, [w, h]);
  return <canvas ref={ref} style={{ width: w, height: h }} className="rounded bg-neutral-950 border border-neutral-800 align-middle" />;
}

// ----- drawing -----

function fill(c: CanvasRenderingContext2D, w: number, h: number) {
  c.clearRect(0, 0, w, h);
}

function trace(c: CanvasRenderingContext2D, w: number, h: number, ring: Ring, lo: number, hi: number, color: string) {
  const n = ring.data.length;
  const span = hi - lo || 1;
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const v = Math.max(0, Math.min(1, (readRing(ring, i) - lo) / span));
    const x = (i / (n - 1)) * w;
    const y = h - 1 - v * (h - 2);
    if (i) c.lineTo(x, y);
    else c.moveTo(x, y);
  }
  c.strokeStyle = color;
  c.lineWidth = 1;
  c.stroke();
}

function zero(c: CanvasRenderingContext2D, w: number, h: number, lo: number, hi: number) {
  if (lo >= 0 || hi <= 0) return;
  const y = h - 1 - ((0 - lo) / (hi - lo)) * (h - 2);
  c.strokeStyle = "#262626";
  c.beginPath();
  c.moveTo(0, y);
  c.lineTo(w, y);
  c.stroke();
}

function bar(c: CanvasRenderingContext2D, w: number, h: number, v: number, color: string) {
  c.fillStyle = color;
  c.fillRect(0, 0, Math.max(0, Math.min(1, v)) * w, h);
}

// ----- helpers -----

const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2));

// The live (modulated) value of a path, falling back to the doc value.
function live(path: string, fallback: number): number {
  return getEngine().mods.values.get(path) ?? fallback;
}

// The range a mod's mapped output can span, for scope scaling.
function mappedRange(m: Mod): [number, number] {
  const a = m.min;
  const b = m.max;
  const lo = m.bipolar ? Math.min(a - (b - a), a, b) : Math.min(a, b);
  const hi = Math.max(a, b);
  return lo === hi ? [lo - 1, hi + 1] : [lo, hi];
}

// Every numeric param a mod can drive: layer opacity, each effect param from the
// registry, and the macro knobs (macros can modulate macros).
// Everything the engine reads through param(): layer opacity, transform and mask fields
// (sources/transform.ts, sources/mask.ts), video speed/volume, effect params, macros.
const TRANSFORM_KEYS = ["x", "y", "scale", "scaleX", "scaleY", "rotation", "anchorX", "anchorY"];
const MASK_KEYS = ["x", "y", "w", "h", "softness"];

function collectTargets(doc: Doc): string[] {
  const t: string[] = [];
  for (const l of doc.layers) {
    t.push(`layers.${l.id}.opacity`);
    for (const k of TRANSFORM_KEYS) t.push(`layers.${l.id}.transform.${k}`);
    for (const k of MASK_KEYS) t.push(`layers.${l.id}.mask.${k}`);
    if (l.source.type === "video") t.push(`layers.${l.id}.source.speed`, `layers.${l.id}.source.volume`);
    for (const fx of l.effects) {
      const def = EFFECTS[fx.type];
      if (!def) continue;
      for (const k of Object.keys(def.defaults)) t.push(`layers.${l.id}.effects.${fx.id}.params.${k}`);
    }
  }
  for (const mc of doc.macros) t.push(`macros.${mc.id}.value`);
  return t;
}

function targetLabel(doc: Doc, path: string): string {
  const s = path.split(".");
  if (s[0] === "layers") {
    const l = doc.layers.find((x) => x.id === s[1]);
    const name = l?.name ?? s[1];
    if (s.length === 3) return `${name} · ${s[2]}`;
    if (s.length === 4) return `${name} · ${s[2]} ${s[3]}`;
    if (s.length === 6) {
      const fx = l?.effects.find((f) => f.id === s[3]);
      return `${name} · ${fx ? EFFECTS[fx.type]?.label ?? fx.type : s[3]} · ${s[5]}`;
    }
  }
  if (s[0] === "macros") return `macro · ${doc.macros.find((m) => m.id === s[1])?.name ?? s[1]}`;
  return path;
}
