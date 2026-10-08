// Editable node graph over the same doc: sources -> effect chains -> composite -> outputs,
// with mod sources (audio signals, LFOs, envelopes, macros) wired into param handles.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type ReactFlowInstance,
  type XYPosition,
} from "@xyflow/react";
import { useDoc } from "../../doc/store";
import { EFFECT_LIST } from "../../engine/effects";
import { useUi } from "../shell/uiStore";
import { buildGraph, layerOfNode } from "../graph/model";
import { nodeTypes } from "../graph/nodes";
import { edgeTypes } from "../graph/edges";
import { addEffect, addGenerator, addMacro, connect, deleteNodes, deleteOps } from "../graph/ops";
import { btn } from "./classes";

type Menu = { x: number; y: number; layerId?: string; nodeId?: string };

const MENU_GAP = 6;

export function GraphPanel() {
  const doc = useDoc((s) => s.doc);
  const patch = useDoc((s) => s.patch);
  const selectedLayer = useUi((s) => s.selectedLayer);
  const setUi = useUi((s) => s.set);

  // The layout is derived from the doc on every change; ids stay stable, and only nodes the
  // user actually dragged keep their own position (pinned below).
  const derived = useMemo(() => buildGraph(doc, selectedLayer), [doc, selectedLayer]);
  const pinned = useRef(new Map<string, XYPosition>());
  const [nodes, setNodes] = useState<Node[]>(derived.nodes);
  const [edges, setEdges] = useState<Edge[]>(derived.edges);
  useEffect(() => setNodes((prev) => mergeNodes(derived.nodes, prev, pinned.current)), [derived.nodes]);
  useEffect(() => setEdges((prev) => mergeEdges(derived.edges, prev)), [derived.edges]);

  const [menu, setMenu] = useState<Menu | null>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number; maxHeight: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const menuBox = useRef<HTMLDivElement>(null);
  const flow = useRef<ReactFlowInstance<Node, Edge> | null>(null);
  const fitted = useRef(false);

  // Dockview keeps hidden tabs at zero size, where fitView does nothing; fit on the first real size.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (fitted.current || el.clientWidth === 0) return;
      fitted.current = true;
      flow.current?.fitView({ padding: 0.15 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keep the context menu inside the panel: measure it, then clamp before the browser paints.
  useLayoutEffect(() => {
    if (!menu) {
      setMenuPos(null);
      return;
    }
    const m = menuBox.current?.getBoundingClientRect();
    const b = box.current?.getBoundingClientRect();
    if (!m || !b) return;
    const maxHeight = Math.max(80, b.height - 2 * MENU_GAP);
    const h = Math.min(m.height, maxHeight);
    setMenuPos({
      left: clamp(menu.x, MENU_GAP, Math.max(MENU_GAP, b.width - m.width - MENU_GAP)),
      top: clamp(menu.y, MENU_GAP, Math.max(MENU_GAP, b.height - h - MENU_GAP)),
      maxHeight,
    });
  }, [menu]);

  // The menu no longer closes on mouse-leave (it opens under the cursor, so that fired instantly).
  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e.type === "mousedown" && menuBox.current?.contains(e.target as globalThis.Node)) return;
      setMenu(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menu]);

  const onNodesChange = useCallback((ch: NodeChange<Node>[]) => {
    for (const c of ch) if (c.type === "position" && c.position) pinned.current.set(c.id, c.position);
    setNodes((n) => applyNodeChanges(ch, n));
  }, []);

  const onConnect = useCallback((c: Connection) => void connect(useDoc.getState().doc, patch, c), [patch]);
  const onReconnect = useCallback(
    (old: Edge, c: Connection) => void connect(useDoc.getState().doc, patch, c, old.id.startsWith("mod:") ? old.id.slice(4) : undefined),
    [patch],
  );
  // One handler for nodes AND their edges: React Flow reports both together, so this stays one
  // patch and one undo step (deleting a layer used to need two undos to get its mods back).
  const onDelete = useCallback(
    ({ nodes: gone, edges: goneEdges }: { nodes: Node[]; edges: Edge[] }) => {
      const ops = deleteOps(
        useDoc.getState().doc,
        gone.map((n) => n.id),
        goneEdges.filter((e) => e.id.startsWith("mod:")).map((e) => e.id.slice(4)),
      );
      if (ops.length) void patch(ops);
    },
    [patch],
  );
  const onSelectionChange = useCallback(
    ({ nodes: sel }: { nodes: Node[] }) => {
      const layerId = sel.map((n) => layerOfNode(n.id)).find(Boolean);
      if (layerId && layerId !== useUi.getState().selectedLayer) setUi({ selectedLayer: layerId });
    },
    [setUi],
  );

  const openMenu = (e: React.MouseEvent, nodeId?: string) => {
    e.preventDefault();
    const r = box.current?.getBoundingClientRect();
    setMenu({ x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0), layerId: (nodeId && layerOfNode(nodeId)) || selectedLayer, nodeId });
  };
  const run = (fn: () => void) => () => {
    fn();
    setMenu(null);
  };
  const menuLayer = doc.layers.find((l) => l.id === menu?.layerId);
  const menuNode = menu?.nodeId ? nodes.find((n) => n.id === menu.nodeId) : undefined;

  return (
    <div className="relative h-full" ref={box}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={(i) => void (flow.current = i)}
        onNodesChange={onNodesChange}
        onEdgesChange={(ch) => setEdges((e) => applyEdgeChanges(ch, e))}
        onConnect={onConnect}
        onReconnect={onReconnect}
        onDelete={onDelete}
        onSelectionChange={onSelectionChange}
        isValidConnection={isValidConnection}
        onPaneClick={() => setMenu(null)}
        onPaneContextMenu={(e) => openMenu(e as React.MouseEvent)}
        onNodeContextMenu={(e, n) => openMenu(e, n.id)}
        deleteKeyCode={["Delete", "Backspace"]}
        minZoom={0.15}
        fitView
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} color="#23232b" />
        <Controls showInteractive={false} />
      </ReactFlow>
      {menu && (
        <div
          ref={menuBox}
          className="absolute z-10 flex w-52 flex-col overflow-auto rounded border border-neutral-700 bg-neutral-900 p-1 text-xs shadow-xl"
          style={{ left: menuPos?.left ?? menu.x, top: menuPos?.top ?? menu.y, maxHeight: menuPos?.maxHeight, visibility: menuPos ? "visible" : "hidden" }}
        >
          <div className="px-1 pb-1 text-[10px] text-neutral-500">{menuLayer ? `add effect to ${menuLayer.name}` : "select a layer to add effects"}</div>
          {menuLayer && (
            <div className="mb-1 max-h-48 overflow-auto">
              {EFFECT_LIST.map((e) => (
                <button key={e.type} className="block w-full rounded px-1 py-0.5 text-left hover:bg-neutral-800" onClick={run(() => addEffect(patch, menuLayer.id, e.type))}>
                  {e.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex shrink-0 gap-1 border-t border-neutral-800 pt-1">
            <button className={btn} onClick={run(() => addGenerator(patch, "lfo"))}>+ lfo</button>
            <button className={btn} onClick={run(() => addGenerator(patch, "env"))}>+ env</button>
            <button className={btn} onClick={run(() => addMacro(doc, patch))}>+ macro</button>
          </div>
          {menuNode && menuNode.deletable !== false && (
            <button className="mt-1 block w-full shrink-0 rounded px-1 py-0.5 text-left text-rose-300 hover:bg-neutral-800" onClick={run(() => deleteNodes(doc, patch, [menuNode.id]))}>
              delete node
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

// Mod sources only land on param handles; chain handles only take chain sources, inside one layer.
function isValidConnection(c: Connection | Edge): boolean {
  if (c.source === c.target) return false;
  const fromMod = /^(sig|lfo|env|macro):/.test(c.source);
  const toParam = (c.targetHandle ?? "").startsWith("p:");
  if (fromMod !== toParam) return false;
  if (fromMod) return true;
  const a = layerOfNode(c.source);
  const b = layerOfNode(c.target);
  return !a || !b || a === b;
}

// Rebuild merging. Two things matter here:
// 1. An unchanged node keeps its OLD object, because React Flow reuses its measurement only when
//    the object is identical (re-measuring hides every node and drops every edge for a frame).
// 2. A changed node inherits `measured` from the old one, for the same reason.
// Derived positions win unless the user dragged that node, so new nodes never land on old ones.
function mergeNodes(next: Node[], prev: Node[], pinned: Map<string, XYPosition>): Node[] {
  const by = new Map(prev.map((n) => [n.id, n]));
  let changed = next.length !== prev.length;
  const out = next.map((n, i) => {
    const pin = pinned.get(n.id);
    const want = pin ? { ...n, position: pin } : n;
    const p = by.get(n.id);
    if (!p) {
      changed = true;
      return want;
    }
    if (prev[i]?.id !== n.id) changed = true;
    if (nodeSig(p) === nodeSig(want)) return p;
    changed = true;
    return { ...p, ...want, measured: p.measured };
  });
  return changed ? out : prev;
}

function mergeEdges(next: Edge[], prev: Edge[]): Edge[] {
  const by = new Map(prev.map((e) => [e.id, e]));
  let changed = next.length !== prev.length;
  const out = next.map((e, i) => {
    const p = by.get(e.id);
    if (!p) {
      changed = true;
      return e;
    }
    if (prev[i]?.id !== e.id) changed = true;
    if (edgeSig(p) === edgeSig(e)) return p;
    changed = true;
    return { ...p, ...e };
  });
  return changed ? out : prev;
}

// Everything buildGraph controls. React Flow owns the rest (selection, dragging, measurements).
function nodeSig(n: Node) {
  return `${n.type}|${n.position.x},${n.position.y}|${n.deletable}|${JSON.stringify(n.data)}`;
}

function edgeSig(e: Edge) {
  return `${e.type}|${e.source}/${e.sourceHandle}|${e.target}/${e.targetHandle}|${e.animated}|${e.label}|${JSON.stringify(e.data)}`;
}
