import { useEffect, useRef, useState } from "react";
import { pickFile } from "../../rpc";
import { useDoc } from "../../doc/store";
import { BlendModes, LayerSchema, MaskTypes, TransformSchema, uid, type Layer } from "../../doc/schema";
import { EFFECTS, EffectTypes } from "../../engine/effects";
import { MEDIA_ELEMENTS, VIDEO_STATUS, type VideoStatus } from "../../engine/sources/media";
import { useUi } from "../shell/uiStore";
import { paneSyncing, useTweakpane } from "../hooks/useTweakpane";
import { btn, sel } from "./classes";

// Transform, mask and source are written as whole sub-objects: the parent path always
// exists (so docs saved before these fields still take edits) and the values are read
// fresh from the store rather than from a stale Tweakpane closure.
type SubKey = "transform" | "mask" | "source";
function setSub(layerId: string, key: SubKey, patchObj: Record<string, unknown>) {
  const st = useDoc.getState();
  const l = st.doc.layers.find((x) => x.id === layerId);
  if (!l) return;
  return st.set(`layers.${layerId}.${key}`, { ...l[key], ...patchObj });
}

// Same, but for writes a Tweakpane change event can reach: refreshing the pane fires change for
// every value it just read out of the doc, and writing those back would corrupt the undo history.
function editSub(layerId: string, key: SubKey, patchObj: Record<string, unknown>) {
  if (!paneSyncing()) setSub(layerId, key, patchObj);
}

const chip = "px-1 rounded text-[10px] leading-4 border";
const off = "border-neutral-700 text-neutral-500 hover:text-neutral-300";

export function LayersPanel() {
  const doc = useDoc((s) => s.doc);
  const patch = useDoc((s) => s.patch);
  const set = useDoc((s) => s.set);
  const selected = useUi((s) => s.selectedLayer);
  const setUi = useUi((s) => s.set);
  const layer = doc.layers.find((l) => l.id === selected);
  const drag = useRef<string | null>(null);

  const add = (name: string, source: unknown) => {
    const l = LayerSchema.parse({ id: uid("L"), name, source });
    patch([{ op: "add", path: "layers", value: l }]);
    setUi({ selectedLayer: l.id });
  };
  const addMedia = async (type: "video" | "image", extensions: string[]) => {
    const file = await pickFile({ extensions });
    if (!file) return;
    const name = String(file).split(/[\\/]/).pop() ?? type;
    add(name, type === "video" ? { type, path: file, startedAt: Date.now() } : { type, path: file });
  };
  const pickMedia = async () => {
    const dir = await pickFile({ directory: true });
    if (dir) set("mediaDir", dir);
  };

  // Reorder by dropping one row onto another. The doc holds layers bottom-to-top.
  const drop = (targetId: string) => {
    const from = doc.layers.findIndex((l) => l.id === drag.current);
    const to = doc.layers.findIndex((l) => l.id === targetId);
    drag.current = null;
    if (from < 0 || to < 0 || from === to) return;
    const arr = [...doc.layers];
    arr.splice(to, 0, arr.splice(from, 1)[0]);
    set("layers", arr);
  };

  return (
    <div className="h-full flex text-xs">
      <div className="w-56 border-r border-neutral-800 flex flex-col">
        <div className="flex flex-wrap gap-1 p-1 border-b border-neutral-800">
          <button className={btn} onClick={() => add("test", { type: "test", pattern: "circles" })}>+ test</button>
          <button className={btn} onClick={() => add("color", { type: "color", rgb: [1, 1, 1] })}>+ color</button>
          <button className={btn} onClick={() => addMedia("video", ["mp4", "mov", "m4v", "webm"])}>+ video</button>
          <button className={btn} onClick={() => addMedia("image", ["png", "jpg", "jpeg", "webp", "gif"])}>+ image</button>
          <button className={btn} onClick={pickMedia} title={doc.mediaDir || "media dir"}>dir</button>
        </div>
        {/* reversed: the top row is the top of the stack */}
        <div className="flex-1 overflow-auto p-1 flex flex-col-reverse justify-end gap-0.5">
          {doc.layers.map((l) => (
            <LayerRow
              key={l.id}
              layer={l}
              selected={l.id === selected}
              onSelect={() => setUi({ selectedLayer: l.id })}
              onDragStart={() => (drag.current = l.id)}
              onDrop={() => drop(l.id)}
            />
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto min-w-0">{layer ? <LayerEditor layer={layer} /> : <div className="text-neutral-500 p-2">select a layer</div>}</div>
    </div>
  );
}

function LayerRow({ layer, selected, onSelect, onDragStart, onDrop }: {
  layer: Layer; selected: boolean; onSelect: () => void; onDragStart: () => void; onDrop: () => void;
}) {
  const set = useDoc((s) => s.set);
  const [editing, setEditing] = useState(false);
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", layer.id); onDragStart(); }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      className={sel(selected) + " flex items-center gap-1"}
      onClick={onSelect}
    >
      <Thumb layer={layer} />
      {editing ? (
        <input
          autoFocus
          defaultValue={layer.name}
          className="flex-1 min-w-0 bg-neutral-900 border border-sky-700 rounded px-1"
          onClick={(e) => e.stopPropagation()}
          onBlur={(e) => { setEditing(false); set(`layers.${layer.id}.name`, e.target.value); }}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditing(false); }}
        />
      ) : (
        <span className="flex-1 min-w-0 truncate" onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}>
          {layer.name}
        </span>
      )}
      <button
        className={`${chip} ${layer.enabled ? off : "border-amber-600 text-amber-400"}`}
        title="mute"
        onClick={(e) => { e.stopPropagation(); set(`layers.${layer.id}.enabled`, !layer.enabled); }}
      >M</button>
      <button
        className={`${chip} ${layer.solo ? "border-sky-500 text-sky-300" : off}`}
        title="solo"
        onClick={(e) => { e.stopPropagation(); set(`layers.${layer.id}.solo`, !layer.solo); }}
      >S</button>
    </div>
  );
}

// Tiny live preview: the real frame for video/image sources, a swatch for the generated ones.
function Thumb({ layer }: { layer: Layer }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const paint = () => {
      const c = ref.current;
      const g = c?.getContext("2d");
      if (!c || !g) return;
      const el = MEDIA_ELEMENTS.get(layer.id);
      const live = el instanceof HTMLImageElement ? el.complete && el.naturalWidth > 0 : !!el && el.readyState >= 2;
      if (el && live) {
        try {
          g.drawImage(el, 0, 0, c.width, c.height);
          return;
        } catch {
          // not decodable yet; fall through to the swatch
        }
      }
      const src = useDoc.getState().doc.layers.find((l) => l.id === layer.id)?.source;
      if (src?.type === "color") {
        const [r, gr, b] = src.rgb;
        g.fillStyle = `rgb(${r * 255},${gr * 255},${b * 255})`;
      } else {
        g.fillStyle = "#1f1f1f";
      }
      g.fillRect(0, 0, c.width, c.height);
      if (src?.type === "test") {
        g.strokeStyle = "#3f3f46";
        g.beginPath();
        for (let x = 8; x < c.width; x += 8) { g.moveTo(x, 0); g.lineTo(x, c.height); }
        for (let y = 8; y < c.height; y += 8) { g.moveTo(0, y); g.lineTo(c.width, y); }
        g.stroke();
      }
    };
    paint();
    const id = setInterval(paint, 300);
    return () => clearInterval(id);
  }, [layer.id]);
  return <canvas ref={ref} width={40} height={23} className="rounded bg-black shrink-0" />;
}

function LayerEditor({ layer }: { layer: Layer }) {
  const patch = useDoc((s) => s.patch);
  const set = useDoc((s) => s.set);
  const setUi = useUi((s) => s.set);
  const L = `layers.${layer.id}`;
  // `set` for paths written from a pane change event; see editSub.
  const put = (path: string, value: unknown) => { if (!paneSyncing()) set(path, value); };

  const duplicate = () => {
    const copy = LayerSchema.parse(JSON.parse(JSON.stringify(layer)));
    copy.id = uid("L");
    copy.name = layer.name + " copy";
    copy.effects = copy.effects.map((f) => ({ ...f, id: uid("fx") }));
    patch([{ op: "add", path: "layers", value: copy }]);
    setUi({ selectedLayer: copy.id });
  };
  const moveFx = (i: number, d: number) => {
    const arr = [...layer.effects];
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    set(`${L}.effects`, arr);
  };

  const chainKey = layer.effects.map((e) => e.id + e.type).join();
  const ref = useTweakpane((pane) => {
    type Opts = Parameters<typeof pane.addBinding>[2];
    // Bindings hold copies of the doc values; each block adds the step that mirrors the doc
    // back into its copy. The hook runs them after every doc change, then refreshes the pane.
    const pulls: ((l: Layer) => void)[] = [];
    const p = { opacity: layer.opacity, blend: layer.blend };
    pane.addBinding(p, "opacity", { min: 0, max: 1 }).on("change", (e) => put(`${L}.opacity`, e.value));
    pane.addBinding(p, "blend", { options: Object.fromEntries(BlendModes.map((b) => [b, b])) }).on("change", (e) => put(`${L}.blend`, e.value));
    pulls.push((l) => { p.opacity = l.opacity; p.blend = l.blend; });

    const tf = pane.addFolder({ title: "transform" });
    const t = { ...layer.transform };
    pulls.push((l) => Object.assign(t, l.transform));
    const tb = (k: keyof typeof t, opts?: Opts) => tf.addBinding(t, k, opts).on("change", (e) => editSub(layer.id, "transform", { [k]: e.value }));
    tb("x", { min: -1, max: 1 });
    tb("y", { min: -1, max: 1 });
    tb("scale", { min: 0, max: 4 });
    tb("scaleX", { min: 0, max: 4 });
    tb("scaleY", { min: 0, max: 4 });
    tb("rotation", { min: -180, max: 180 });
    tb("anchorX", { min: 0, max: 1 });
    tb("anchorY", { min: 0, max: 1 });
    tb("flipX");
    tb("flipY");
    tf.addButton({ title: "reset" }).on("click", () => set(`${L}.transform`, TransformSchema.parse({})));

    const mf = pane.addFolder({ title: "mask", expanded: layer.mask.type !== "none" });
    const m = { ...layer.mask };
    pulls.push((l) => Object.assign(m, l.mask));
    const mb = (k: keyof typeof m, opts?: Opts) => mf.addBinding(m, k, opts).on("change", (e) => editSub(layer.id, "mask", { [k]: e.value }));
    mb("type", { options: Object.fromEntries(MaskTypes.map((x) => [x, x])) });
    mb("invert");
    mb("x", { min: 0, max: 1 });
    mb("y", { min: 0, max: 1 });
    mb("w", { min: 0, max: 2 });
    mb("h", { min: 0, max: 2 });
    mb("softness", { min: 0.001, max: 0.5 });

    const sf = pane.addFolder({ title: `source: ${layer.source.type}` });
    if (layer.source.type === "test") {
      const s = { pattern: layer.source.pattern };
      sf.addBinding(s, "pattern", { options: { grid: "grid", bars: "bars", noise: "noise", circles: "circles" } }).on("change", (e) => editSub(layer.id, "source", { pattern: e.value }));
      pulls.push((l) => { if (l.source.type === "test") s.pattern = l.source.pattern; });
    } else if (layer.source.type === "color") {
      const [r, g, b] = layer.source.rgb;
      const s = { r, g, b };
      const write = () => editSub(layer.id, "source", { rgb: [s.r, s.g, s.b] });
      for (const k of ["r", "g", "b"] as const) sf.addBinding(s, k, { min: 0, max: 1 }).on("change", write);
      pulls.push((l) => { if (l.source.type === "color") { s.r = l.source.rgb[0]; s.g = l.source.rgb[1]; s.b = l.source.rgb[2]; } });
    } else if (layer.source.type === "video") {
      const dur = VIDEO_STATUS.get(layer.id)?.duration || 60;
      const s = {
        speed: layer.source.speed, loop: layer.source.loop, pingpong: layer.source.pingpong,
        in: layer.source.in, out: layer.source.out, muted: layer.source.muted, volume: layer.source.volume,
      };
      pulls.push((l) => {
        if (l.source.type !== "video") return;
        const v = l.source;
        Object.assign(s, { speed: v.speed, loop: v.loop, pingpong: v.pingpong, in: v.in, out: v.out, muted: v.muted, volume: v.volume });
      });
      const sb = (k: keyof typeof s, opts?: Opts) => sf.addBinding(s, k, opts).on("change", (e) => editSub(layer.id, "source", { [k]: e.value }));
      sb("speed", { min: 0.1, max: 4 });
      sb("loop");
      sb("pingpong");
      sb("in", { min: 0, max: dur, step: 0.01 });
      // out <= in means "to the end of the clip"
      sb("out", { min: 0, max: dur, step: 0.01 });
      sb("muted");
      sb("volume", { min: 0, max: 1 });
    } else if (layer.source.type === "image") {
      const s = { path: layer.source.path };
      sf.addBinding(s, "path", { readonly: true });
    }

    for (const fx of layer.effects) {
      const def = EFFECTS[fx.type];
      const f = pane.addFolder({ title: `${def.label} (${fx.id})`, expanded: true });
      const params = { ...def.defaults, ...fx.params };
      for (const k of Object.keys(def.defaults)) {
        f.addBinding(params, k, def.ranges[k] ?? { min: 0, max: 1 }).on("change", (e) => put(`${L}.effects.${fx.id}.params.${k}`, e.value));
      }
      pulls.push((l) => {
        const cur = l.effects.find((x) => x.id === fx.id);
        if (cur) Object.assign(params, def.defaults, cur.params);
      });
    }

    return () => {
      const l = useDoc.getState().doc.layers.find((x) => x.id === layer.id);
      if (l) for (const f of pulls) f(l);
    };
  }, [layer.id, chainKey, layer.source.type]);

  return (
    <div className="p-1 flex flex-col gap-1">
      <div className="flex gap-1 items-center">
        <span className="flex-1 truncate text-neutral-300">{layer.name}</span>
        <button className={btn} onClick={duplicate}>duplicate</button>
        <button className={btn} onClick={() => patch([{ op: "remove", path: L }])}>delete</button>
      </div>
      {layer.source.type === "video" && <Transport layer={layer} />}
      <EffectChain layer={layer} onMove={moveFx} />
      <div ref={ref} />
    </div>
  );
}

// Video transport. Every control resolves to one doc field: startedAt, the epoch ms the
// clip started, from which each window derives its own playhead.
function Transport({ layer }: { layer: Layer }) {
  const [st, setSt] = useState<VideoStatus | undefined>();
  useEffect(() => {
    const id = setInterval(() => {
      const s = VIDEO_STATUS.get(layer.id);
      setSt(s ? { ...s } : undefined);
    }, 120);
    return () => clearInterval(id);
  }, [layer.id]);
  if (layer.source.type !== "video") return null;
  const src = layer.source;
  const dur = st?.duration ?? 0;
  const rate = Math.max(0.0625, Math.abs(src.speed) || 1);
  // the anchor that puts the playhead at `t` right now
  const anchorFor = (t: number) => Date.now() - ((t - src.in) / rate) * 1000;

  return (
    <div className="flex items-center gap-1 border border-neutral-800 rounded p-1">
      <button
        className={btn}
        onClick={() => setSub(layer.id, "source", { playing: !src.playing, startedAt: src.playing ? src.startedAt : anchorFor(st?.time ?? src.in) })}
      >{src.playing ? "pause" : "play"}</button>
      <button className={btn} onClick={() => setSub(layer.id, "source", { startedAt: Date.now(), playing: true })}>restart</button>
      <input
        type="range"
        className="flex-1 min-w-0"
        min={0}
        max={dur || 1}
        step={0.01}
        value={st?.time ?? 0}
        disabled={!dur}
        onChange={(e) => setSub(layer.id, "source", { startedAt: anchorFor(Number(e.target.value)) })}
      />
      <span className="text-neutral-500 tabular-nums w-24 text-right">
        {(st?.time ?? 0).toFixed(1)} / {dur.toFixed(1)}s
      </span>
    </div>
  );
}

function EffectChain({ layer, onMove }: { layer: Layer; onMove: (i: number, d: number) => void }) {
  const patch = useDoc((s) => s.patch);
  const set = useDoc((s) => s.set);
  const [type, setType] = useState<string>(EffectTypes[0]);
  const L = `layers.${layer.id}`;
  return (
    <div className="border border-neutral-800 rounded">
      {layer.effects.map((fx, i) => (
        <div key={fx.id} className="flex items-center gap-1 px-1 py-0.5 border-b border-neutral-800 last:border-b-0">
          <input type="checkbox" checked={fx.enabled} onChange={(e) => set(`${L}.effects.${fx.id}.enabled`, e.target.checked)} />
          <span className="flex-1 truncate">{EFFECTS[fx.type].label}</span>
          <button className={`${chip} ${off}`} title="earlier in the chain (towards the source)" onClick={() => onMove(i, -1)}>&#9650;</button>
          <button className={`${chip} ${off}`} title="later in the chain" onClick={() => onMove(i, 1)}>&#9660;</button>
          <button className={`${chip} ${off}`} title="remove" onClick={() => patch([{ op: "remove", path: `${L}.effects.${fx.id}` }])}>&#215;</button>
        </div>
      ))}
      <div className="flex items-center gap-1 p-1">
        <select className="bg-neutral-900 border border-neutral-700 rounded px-1 py-0.5 flex-1" value={type} onChange={(e) => setType(e.target.value)}>
          {EffectTypes.map((t) => <option key={t} value={t}>{EFFECTS[t].label}</option>)}
        </select>
        <button className={btn} onClick={() => patch([{ op: "add", path: `${L}.effects`, value: { id: uid("fx"), type, enabled: true, params: {} } }])}>+ effect</button>
      </div>
    </div>
  );
}
