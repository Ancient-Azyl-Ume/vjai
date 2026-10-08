// Derives the React Flow graph from the doc. Positions are computed here every render
// (never persisted); ids are stable so React Flow keeps its own selection and drag state.
import type { Edge, Node } from "@xyflow/react";
import { ModSources, type Doc, type Mod } from "../../doc/schema";
import { EFFECTS, type ParamRange } from "../../engine/effects";

// Generators get one node per mod (their knobs live on the mod itself); every other
// non-macro source is a shared signal node you can wire to many params.
export const GEN_SOURCES = ["lfo", "env"] as const;
export const AUDIO_SIGNALS = ModSources.filter((s) => s !== "macro" && !GEN_SOURCES.includes(s as (typeof GEN_SOURCES)[number]));

// Layer params the layer node exposes as mod targets. Anything else stays in the layers panel.
export const LAYER_PARAMS: { key: string; label: string; range: ParamRange; slider?: boolean }[] = [
  { key: "opacity", label: "opacity", range: { min: 0, max: 1 }, slider: true },
  { key: "transform.scale", label: "scale", range: { min: 0, max: 4 }, slider: true },
  { key: "transform.x", label: "x", range: { min: -1, max: 1 } },
  { key: "transform.y", label: "y", range: { min: -1, max: 1 } },
  { key: "transform.rotation", label: "rot", range: { min: -180, max: 180 } },
];

export type LayerData = { layerId: string; active: boolean };
export type EffectData = { layerId: string; effectId: string; active: boolean };
export type SignalData = { signal: string };
export type GenData = { modId: string };
export type MacroData = { macroId: string };
export type CompositeData = { label: string };
export type OutputData = { outputId: string };
export type ModEdgeData = { modId: string };

const COL_SRC = -340;
const SRC_W = 145;
const SRC_H = 46;
const FX_X0 = 250;
const FX_DX = 220;
const ROW_H = 200;

export function nodeIdForLayer(layerId: string) {
  return `layer:${layerId}`;
}
export function nodeIdForEffect(layerId: string, effectId: string) {
  return `fx:${layerId}:${effectId}`;
}

// "p:<key>" handle on a layer or effect node -> the dotted doc path of that param.
export function paramPath(nodeId: string, handleId: string | null | undefined): string | null {
  if (!handleId || !handleId.startsWith("p:")) return null;
  const key = handleId.slice(2);
  if (nodeId.startsWith("layer:")) return `layers.${nodeId.slice(6)}.${key}`;
  if (nodeId.startsWith("fx:")) {
    const [, layerId, effectId] = nodeId.split(":");
    return `layers.${layerId}.effects.${effectId}.params.${key}`;
  }
  // a macro can itself be modulated
  if (nodeId.startsWith("macro:") && key === "value") return `macros.${nodeId.slice(6)}.value`;
  return null;
}

// The reverse: a mod target path -> the node and handle it lands on (null if we do not draw it).
export function paramHandle(target: string): { nodeId: string; handleId: string } | null {
  const s = target.split(".");
  if (s[0] === "macros" && s.length === 3 && s[2] === "value") return { nodeId: `macro:${s[1]}`, handleId: "p:value" };
  if (s[0] !== "layers") return null;
  if (s[2] === "effects" && s[4] === "params" && s.length === 6) return { nodeId: nodeIdForEffect(s[1], s[3]), handleId: `p:${s[5]}` };
  const key = s.slice(2).join(".");
  if (LAYER_PARAMS.some((p) => p.key === key)) return { nodeId: nodeIdForLayer(s[1]), handleId: `p:${key}` };
  return null;
}

export function modSourceNodeId(m: Mod): string {
  if (GEN_SOURCES.includes(m.source as (typeof GEN_SOURCES)[number])) return `${m.source}:${m.id}`;
  if (m.source === "macro") return `macro:${m.sourceId}`;
  return `sig:${m.source}`;
}

// A mod-source node id -> the mod fields that select that source.
export function sourceOfNode(nodeId: string): { source: Mod["source"]; sourceId: string } | null {
  const [kind, rest] = [nodeId.slice(0, nodeId.indexOf(":")), nodeId.slice(nodeId.indexOf(":") + 1)];
  if (kind === "sig") return { source: rest as Mod["source"], sourceId: "" };
  if (kind === "macro") return { source: "macro", sourceId: rest };
  if (GEN_SOURCES.includes(kind as (typeof GEN_SOURCES)[number])) return { source: kind as Mod["source"], sourceId: "" };
  return null;
}

export function isModSourceNode(nodeId: string) {
  return sourceOfNode(nodeId) != null;
}

export function layerOfNode(nodeId: string): string | null {
  if (nodeId.startsWith("layer:")) return nodeId.slice(6);
  if (nodeId.startsWith("fx:")) return nodeId.split(":")[1];
  return null;
}

export function buildGraph(doc: Doc, selectedLayer?: string): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const handles = new Map<string, Set<string>>(); // node id -> param handles it renders
  const maxFx = doc.layers.reduce((m, l) => Math.max(m, l.effects.length), 0);
  const compX = FX_X0 + Math.max(maxFx, 1) * FX_DX + 40;

  doc.layers.forEach((l, i) => {
    const y = i * ROW_H;
    const active = l.id === selectedLayer;
    const layerNode = nodeIdForLayer(l.id);
    nodes.push({ id: layerNode, type: "layer", position: { x: 0, y }, data: { layerId: l.id, active } satisfies LayerData });
    handles.set(layerNode, new Set(LAYER_PARAMS.map((p) => `p:${p.key}`)));
    let prev = layerNode;
    l.effects.forEach((fx, fi) => {
      const def = EFFECTS[fx.type];
      if (!def) return;
      const id = nodeIdForEffect(l.id, fx.id);
      nodes.push({ id, type: "effect", position: { x: FX_X0 + fi * FX_DX, y }, data: { layerId: l.id, effectId: fx.id, active } satisfies EffectData });
      handles.set(id, new Set(Object.keys(def.defaults).map((k) => `p:${k}`)));
      edges.push(chainEdge(prev, id));
      prev = id;
    });
    edges.push({
      ...chainEdge(prev, "composite"),
      label: `${l.blend} ${l.opacity.toFixed(2)}`,
      labelStyle: { fill: "#8a8a94", fontSize: 9 },
      labelBgStyle: { fill: "#0b0b0d" },
    });
  });

  nodes.push({ id: "composite", type: "composite", position: { x: compX, y: 0 }, deletable: false, data: { label: `${doc.canvas.width} x ${doc.canvas.height}` } satisfies CompositeData });
  doc.outputs.forEach((o, i) => {
    const id = `out:${o.id}`;
    nodes.push({ id, type: "output", position: { x: compX + 230, y: i * 90 }, deletable: false, data: { outputId: o.id } satisfies OutputData });
    edges.push(chainEdge("composite", id));
  });

  AUDIO_SIGNALS.forEach((s, i) => {
    nodes.push({
      id: `sig:${s}`,
      type: "signal",
      position: { x: COL_SRC + (i % 2) * SRC_W, y: Math.floor(i / 2) * SRC_H },
      deletable: false,
      data: { signal: s } satisfies SignalData,
    });
  });
  let sy = Math.ceil(AUDIO_SIGNALS.length / 2) * SRC_H + 24;
  for (const m of doc.macros) {
    nodes.push({ id: `macro:${m.id}`, type: "macro", position: { x: COL_SRC, y: sy }, data: { macroId: m.id } satisfies MacroData });
    handles.set(`macro:${m.id}`, new Set(["p:value"]));
    sy += 62;
  }
  sy += 16;
  for (const m of doc.mods) {
    if (!GEN_SOURCES.includes(m.source as (typeof GEN_SOURCES)[number])) continue;
    nodes.push({ id: `${m.source}:${m.id}`, type: "gen", position: { x: COL_SRC, y: sy }, data: { modId: m.id } satisfies GenData });
    sy += 62;
  }

  const ids = new Set(nodes.map((n) => n.id));
  for (const m of doc.mods) {
    const to = paramHandle(m.target);
    const from = modSourceNodeId(m);
    if (!to || !ids.has(from) || !handles.get(to.nodeId)?.has(to.handleId)) continue;
    edges.push({
      id: `mod:${m.id}`,
      type: "mod",
      source: from,
      sourceHandle: "out",
      target: to.nodeId,
      targetHandle: to.handleId,
      animated: m.enabled,
      data: { modId: m.id } satisfies ModEdgeData,
    });
  }
  return { nodes, edges };
}

function chainEdge(source: string, target: string): Edge {
  return { id: `chain:${source}>${target}`, source, sourceHandle: "out", target, targetHandle: "in", deletable: false, style: { stroke: "#4b5563", strokeWidth: 1.5 } };
}
