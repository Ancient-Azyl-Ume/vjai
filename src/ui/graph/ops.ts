// Every doc edit the graph can make. Nothing here mutates the doc: it all goes out as patch ops.
import type { Connection } from "@xyflow/react";
import type { Op } from "../../doc/store";
import { uid, type Doc } from "../../doc/schema";
import { EFFECTS, type EffectType, type ParamRange } from "../../engine/effects";
import { LAYER_PARAMS, layerOfNode, paramPath, sourceOfNode } from "./model";

type Patch = (ops: Op[]) => Promise<void>;

// One connection means one of two things: a mod (source node -> param handle) or a
// reorder of an effect chain (out handle -> in handle inside one layer).
export function connect(doc: Doc, patch: Patch, c: Connection, existingModId?: string) {
  const path = paramPath(c.target, c.targetHandle);
  if (path) return wireMod(doc, patch, c.source, path, existingModId);
  if (c.targetHandle === "in") return reorder(doc, patch, c.source, c.target);
}

function wireMod(doc: Doc, patch: Patch, sourceNode: string, target: string, existingModId?: string) {
  const src = sourceOfNode(sourceNode);
  if (!src) return;
  if (existingModId) {
    const base = `mods.${existingModId}`;
    return patch([
      { op: "set", path: `${base}.source`, value: src.source },
      { op: "set", path: `${base}.sourceId`, value: src.sourceId },
      { op: "set", path: `${base}.target`, value: target },
    ]);
  }
  // A generator node (lfo, env) is one mod: the first wire fills in its target,
  // later ones fork a sibling generator with the same settings. Both take the
  // param's quarter-range amount, so the first wire and its forks behave alike.
  const gen = /^(lfo|env):(.+)$/.exec(sourceNode);
  if (gen) {
    const mod = doc.mods.find((m) => m.id === gen[2]);
    if (!mod) return;
    const amount = amountFor(doc, target);
    if (!mod.target) {
      return patch([
        { op: "set", path: `mods.${mod.id}.target`, value: target },
        { op: "set", path: `mods.${mod.id}.amount`, value: amount },
      ]);
    }
    return patch([{ op: "add", path: "mods", value: { ...mod, id: uid("m"), target, amount } }]);
  }
  return patch([
    {
      op: "add",
      path: "mods",
      value: { id: uid("m"), enabled: true, source: src.source, sourceId: src.sourceId, target, amount: amountFor(doc, target), smooth: 0.6, curve: 1, rate: 1 },
    },
  ]);
}

// The range of the param a mod points at, so amounts and scroll steps stay in its scale.
export function rangeFor(doc: Doc, target: string): ParamRange | null {
  const s = target.split(".");
  if (s.length === 6) {
    const fx = doc.layers.find((l) => l.id === s[1])?.effects.find((e) => e.id === s[3]);
    return (fx && EFFECTS[fx.type]?.ranges[s[5]]) || null;
  }
  return LAYER_PARAMS.find((p) => p.key === s.slice(2).join("."))?.range ?? null;
}

// A quarter of the param's own range, so a fresh mod is visible but not absurd
// (the mod maps its 0..1 signal through min/max, both defaulting to 0..1).
function amountFor(doc: Doc, target: string): number {
  const range = rangeFor(doc, target);
  return range ? Number(((range.max - range.min) * 0.25).toFixed(3)) : 0.5;
}

// Dropping a chain edge on a node moves the target effect right behind the source node.
function reorder(doc: Doc, patch: Patch, sourceNode: string, targetNode: string) {
  const layerId = layerOfNode(targetNode) ?? layerOfNode(sourceNode);
  if (!layerId || (layerOfNode(sourceNode) ?? layerId) !== layerId) return;
  const layer = doc.layers.find((l) => l.id === layerId);
  if (!layer) return;
  const movedId = targetNode.startsWith("fx:") ? targetNode.split(":")[2] : sourceNode.split(":")[2];
  const moved = layer.effects.find((e) => e.id === movedId);
  if (!moved) return;
  const rest = layer.effects.filter((e) => e.id !== movedId);
  let at = rest.length; // fx -> composite: last
  if (targetNode.startsWith("fx:")) {
    if (sourceNode.startsWith("layer:")) at = 0;
    else {
      const anchor = sourceNode.split(":")[2];
      const i = rest.findIndex((e) => e.id === anchor);
      if (i < 0) return;
      at = i + 1;
    }
  }
  rest.splice(at, 0, moved);
  if (rest.every((e, i) => e.id === layer.effects[i].id)) return;
  return patch([{ op: "set", path: `layers.${layerId}.effects`, value: rest }]);
}

export function addEffect(patch: Patch, layerId: string, type: EffectType) {
  return patch([{ op: "add", path: `layers.${layerId}.effects`, value: { id: uid("fx"), type, enabled: true, params: {} } }]);
}

// An unwired generator: it shows up as a node with no edge until you drag from it.
export function addGenerator(patch: Patch, source: "lfo" | "env") {
  return patch([{ op: "add", path: "mods", value: { id: uid("m"), enabled: true, source, sourceId: "", target: "", amount: 0.5, smooth: 0.2, curve: 1, rate: 0.5 } }]);
}

export function addMacro(doc: Doc, patch: Patch) {
  return patch([{ op: "add", path: "macros", value: { id: uid("mac"), name: `macro ${doc.macros.length + 1}`, value: 0 } }]);
}

// Every op a delete needs, as ONE batch: nodes, the mods that pointed at them, and any
// separately selected mod edges. React Flow reports deleted nodes and edges together, and a
// single patch is a single undo step, so one Cmd+Z brings a layer back with its mods.
export function deleteOps(doc: Doc, nodeIds: string[], modIds: string[] = []): Op[] {
  const ops: Op[] = [];
  const mods = new Set<string>(modIds.filter((id) => doc.mods.some((m) => m.id === id)));
  // A layer takes its own effects with it, so skip effect ops that would target a dead layer.
  const goneLayers = new Set(nodeIds.filter((id) => id.startsWith("layer:")).map((id) => id.slice(6)));
  for (const id of nodeIds) {
    if (id.startsWith("fx:")) {
      const [, layerId, effectId] = id.split(":");
      if (goneLayers.has(layerId)) continue;
      ops.push({ op: "remove", path: `layers.${layerId}.effects.${effectId}` });
      const prefix = `layers.${layerId}.effects.${effectId}.`;
      doc.mods.filter((m) => m.target.startsWith(prefix)).forEach((m) => mods.add(m.id));
    } else if (id.startsWith("layer:")) {
      const layerId = id.slice(6);
      ops.push({ op: "remove", path: `layers.${layerId}` });
      doc.mods.filter((m) => m.target.startsWith(`layers.${layerId}.`)).forEach((m) => mods.add(m.id));
    } else if (id.startsWith("lfo:") || id.startsWith("env:")) {
      mods.add(id.slice(id.indexOf(":") + 1));
    } else if (id.startsWith("macro:")) {
      const macroId = id.slice(6);
      ops.push({ op: "remove", path: `macros.${macroId}` });
      doc.mods.filter((m) => (m.source === "macro" && m.sourceId === macroId) || m.target.startsWith(`macros.${macroId}.`)).forEach((m) => mods.add(m.id));
    }
  }
  for (const m of mods) ops.push({ op: "remove", path: `mods.${m}` });
  return ops;
}

export function deleteNodes(doc: Doc, patch: Patch, ids: string[]) {
  const ops = deleteOps(doc, ids);
  if (ops.length) return patch(ops);
}
