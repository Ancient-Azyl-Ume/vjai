// Node bodies for the graph editor. They are plain panel code: read from useDoc, write with set.
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { useDoc } from "../../doc/store";
import { EnvInputs, LfoShapes, getPath } from "../../doc/schema";
import { EFFECTS, type ParamRange } from "../../engine/effects";
import { LAYER_PARAMS, type CompositeData, type EffectData, type GenData, type LayerData, type MacroData, type OutputData, type SignalData } from "./model";

const CARD = "w-[190px] rounded-md border bg-neutral-900/95 text-[10px] shadow-lg";
const SMALL = "relative w-[130px] rounded-md border px-2 py-1 text-[10px] shadow-lg";
const HEAD = "relative flex items-center gap-1 px-2 py-1 rounded-t-md border-b border-neutral-800";
const CHAIN = "!w-2.5 !h-2.5 !bg-neutral-500 !border !border-neutral-900";
const PARAM = "!w-2 !h-2 !bg-emerald-500 !border !border-neutral-900";
const OUT = "!w-2.5 !h-2.5 !bg-emerald-400 !border !border-neutral-900";
const SELECT = "nodrag bg-neutral-800 text-neutral-300 rounded px-1 text-[9px] border border-neutral-700";

function card(active: boolean, selected: boolean | undefined) {
  return `${CARD} ${selected ? "border-sky-400 ring-1 ring-sky-400/50" : active ? "border-sky-700" : "border-neutral-700"}`;
}

function fmt(v: number) {
  return Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2);
}

// One param: a handle a mod can land on, plus (for the important ones) a mini slider.
function ParamRow({ path, label, value, range, handleId, slider }: { path: string; label: string; value: number; range: ParamRange; handleId: string; slider?: boolean }) {
  const set = useDoc((s) => s.set);
  return (
    <div className="relative flex h-4 items-center gap-1">
      <Handle type="target" position={Position.Left} id={handleId} className={PARAM} style={{ left: -13 }} />
      <span className="w-12 shrink-0 truncate text-neutral-500">{label}</span>
      {slider ? (
        <input
          type="range"
          className="nodrag nowheel h-1 flex-1 accent-sky-400"
          min={range.min}
          max={range.max}
          step={range.step ?? (range.max - range.min) / 200}
          value={value}
          onChange={(e) => set(path, Number(e.target.value))}
        />
      ) : (
        <span className="flex-1 text-right tabular-nums text-neutral-400">{fmt(value)}</span>
      )}
    </div>
  );
}

export function LayerNode({ data, selected }: NodeProps<Node<LayerData>>) {
  const layer = useDoc((s) => s.doc.layers.find((l) => l.id === data.layerId));
  const set = useDoc((s) => s.set);
  if (!layer) return null;
  const base = `layers.${layer.id}`;
  return (
    <div className={card(data.active, selected)}>
      <div className={`${HEAD} bg-neutral-800/70`}>
        <input type="checkbox" className="nodrag h-3 w-3 accent-sky-500" checked={layer.enabled} onChange={(e) => set(`${base}.enabled`, e.target.checked)} />
        <span className="flex-1 truncate font-medium text-neutral-200">{layer.name}</span>
        <span className="text-neutral-500">{layer.source.type}</span>
        <Handle type="source" position={Position.Right} id="out" className={CHAIN} />
      </div>
      <div className="flex flex-col gap-1 p-1.5">
        {LAYER_PARAMS.map((p) => (
          <ParamRow key={p.key} path={`${base}.${p.key}`} label={p.label} value={Number(getPath(layer, p.key)) || 0} range={p.range} handleId={`p:${p.key}`} slider={p.slider} />
        ))}
      </div>
    </div>
  );
}

export function EffectNode({ data, selected }: NodeProps<Node<EffectData>>) {
  const fx = useDoc((s) => s.doc.layers.find((l) => l.id === data.layerId)?.effects.find((e) => e.id === data.effectId));
  const set = useDoc((s) => s.set);
  const def = fx && EFFECTS[fx.type];
  if (!fx || !def) return null;
  const base = `layers.${data.layerId}.effects.${fx.id}`;
  return (
    <div className={`${card(data.active, selected)} ${fx.enabled ? "" : "opacity-60"}`}>
      <div className={`${HEAD} bg-indigo-950/70`}>
        <Handle type="target" position={Position.Left} id="in" className={CHAIN} />
        <input type="checkbox" className="nodrag h-3 w-3 accent-sky-500" checked={fx.enabled} onChange={(e) => set(`${base}.enabled`, e.target.checked)} />
        <span className="flex-1 truncate font-medium text-neutral-200">{def.label}</span>
        <Handle type="source" position={Position.Right} id="out" className={CHAIN} />
      </div>
      <div className="flex flex-col gap-1 p-1.5">
        {Object.keys(def.defaults).map((k, i) => (
          <ParamRow
            key={k}
            path={`${base}.params.${k}`}
            label={k}
            value={fx.params[k] ?? def.defaults[k]}
            range={def.ranges[k] ?? { min: 0, max: 1 }}
            handleId={`p:${k}`}
            slider={i < 2}
          />
        ))}
      </div>
    </div>
  );
}

export function CompositeNode({ data }: NodeProps<Node<CompositeData>>) {
  return (
    <div className={`${CARD} border-sky-900 bg-sky-950/80`}>
      <div className={`${HEAD} border-b-0`}>
        <Handle type="target" position={Position.Left} id="in" className={CHAIN} />
        <span className="flex-1 font-medium text-sky-200">composite</span>
        <span className="text-neutral-400">{data.label}</span>
        <Handle type="source" position={Position.Right} id="out" className={CHAIN} />
      </div>
    </div>
  );
}

export function OutputNode({ data }: NodeProps<Node<OutputData>>) {
  const out = useDoc((s) => s.doc.outputs.find((o) => o.id === data.outputId));
  if (!out) return null;
  return (
    <div className={`${CARD} border-fuchsia-900 bg-fuchsia-950/50`}>
      <div className={`${HEAD} border-b-0`}>
        <Handle type="target" position={Position.Left} id="in" className={CHAIN} />
        <span className="flex-1 truncate font-medium text-fuchsia-200">{out.name}</span>
        <span className="text-neutral-400">mon {out.monitor}</span>
      </div>
    </div>
  );
}

export function SignalNode({ data }: NodeProps<Node<SignalData>>) {
  return (
    <div className={`${SMALL} border-emerald-900 bg-emerald-950/60`}>
      <span className="font-medium text-emerald-300">{data.signal}</span>
      <span className="ml-1 text-neutral-500">signal</span>
      <Handle type="source" position={Position.Right} id="out" className={OUT} />
    </div>
  );
}

// LFO / envelope follower: one node per mod, because their knobs live on the mod.
export function GenNode({ data, selected }: NodeProps<Node<GenData>>) {
  const mod = useDoc((s) => s.doc.mods.find((m) => m.id === data.modId));
  const set = useDoc((s) => s.set);
  if (!mod) return null;
  const base = `mods.${mod.id}`;
  const synced = mod.source === "lfo" && mod.sync;
  return (
    <div className={`${SMALL} bg-emerald-950/60 ${selected ? "border-sky-400" : "border-emerald-900"}`}>
      <div className="flex items-center gap-1">
        <input type="checkbox" className="nodrag h-3 w-3 accent-sky-500" checked={mod.enabled} onChange={(e) => set(`${base}.enabled`, e.target.checked)} />
        <span className="flex-1 font-medium text-emerald-300">{mod.source}</span>
        {mod.source === "lfo" ? (
          <select className={SELECT} value={mod.shape} onChange={(e) => set(`${base}.shape`, e.target.value)}>
            {LfoShapes.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        ) : (
          <select className={SELECT} value={mod.envInput} onChange={(e) => set(`${base}.envInput`, e.target.value)}>
            {EnvInputs.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
      </div>
      <div className="mt-1 flex items-center gap-1">
        <span className="w-8 shrink-0 text-neutral-500">{mod.source === "env" ? "rel" : synced ? "beats" : "hz"}</span>
        {mod.source === "env" ? (
          <input type="range" className="nodrag nowheel h-1 flex-1 accent-sky-400" min={1} max={2000} step={1} value={mod.release} onChange={(e) => set(`${base}.release`, Number(e.target.value))} />
        ) : synced ? (
          <input type="range" className="nodrag nowheel h-1 flex-1 accent-sky-400" min={0.25} max={16} step={0.25} value={mod.rateBeats} onChange={(e) => set(`${base}.rateBeats`, Number(e.target.value))} />
        ) : (
          <input type="range" className="nodrag nowheel h-1 flex-1 accent-sky-400" min={0.05} max={8} step={0.05} value={mod.rate} onChange={(e) => set(`${base}.rate`, Number(e.target.value))} />
        )}
        <span className="w-6 shrink-0 text-right tabular-nums text-neutral-500">{fmt(mod.source === "env" ? mod.release : synced ? mod.rateBeats : mod.rate)}</span>
      </div>
      <Handle type="source" position={Position.Right} id="out" className={OUT} />
    </div>
  );
}

export function MacroNode({ data, selected }: NodeProps<Node<MacroData>>) {
  const macro = useDoc((s) => s.doc.macros.find((m) => m.id === data.macroId));
  const set = useDoc((s) => s.set);
  if (!macro) return null;
  return (
    <div className={`${SMALL} bg-amber-950/50 ${selected ? "border-sky-400" : "border-amber-900"}`}>
      <div className="flex items-center gap-1">
        <span className="flex-1 truncate font-medium text-amber-300">{macro.name}</span>
        <span className="tabular-nums text-neutral-500">{fmt(macro.value)}</span>
      </div>
      <input
        type="range"
        className="nodrag nowheel mt-1 h-1 w-full accent-amber-400"
        min={0}
        max={1}
        step={0.01}
        value={macro.value}
        onChange={(e) => set(`macros.${macro.id}.value`, Number(e.target.value))}
      />
      <Handle type="source" position={Position.Right} id="out" className={OUT} />
      <Handle type="target" position={Position.Left} id="p:value" className={PARAM} />
    </div>
  );
}

export const nodeTypes = {
  layer: LayerNode,
  effect: EffectNode,
  composite: CompositeNode,
  output: OutputNode,
  signal: SignalNode,
  gen: GenNode,
  macro: MacroNode,
};
