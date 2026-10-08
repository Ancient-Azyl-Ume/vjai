// Mod edges: dashed link from a signal/lfo/macro node to a param handle.
// Hovering shows the amount, scrolling over the edge changes it.
import { useCallback, useRef, useState } from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from "@xyflow/react";
import { useDoc } from "../../doc/store";
import type { ModEdgeData } from "./model";
import { rangeFor } from "./ops";

type ModEdgeType = Edge<ModEdgeData, "mod">;

// Native non-passive wheel listener: React Flow's own zoom listener sits on the pane,
// deeper-first, so a React onWheel would fire too late to stop it.
function useWheel(fn: (e: WheelEvent) => void) {
  const cb = useRef(fn);
  cb.current = fn;
  return useCallback((el: Element | null) => {
    if (!el) return;
    const h = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      cb.current(e);
    };
    el.addEventListener("wheel", h as EventListener, { passive: false });
    return () => el.removeEventListener("wheel", h as EventListener);
  }, []);
}

export function ModEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected }: EdgeProps<ModEdgeType>) {
  const mod = useDoc((s) => s.doc.mods.find((m) => m.id === data?.modId));
  const set = useDoc((s) => s.set);
  const [hover, setHover] = useState(false);
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  // Step and limits scale with the target param's range: one tick used to snap a blur
  // radius mod (0..64, amount 16) down to the flat +/-4 clamp.
  const wheel = useWheel((e) => {
    if (!mod) return;
    const range = rangeFor(useDoc.getState().doc, mod.target);
    const span = range ? range.max - range.min : 1;
    const step = (e.shiftKey ? 0.01 : 0.05) * span;
    const limit = 4 * span;
    const next = Math.min(limit, Math.max(-limit, mod.amount - Math.sign(e.deltaY) * step));
    set(`mods.${mod.id}.amount`, Number(next.toFixed(3)));
  });
  if (!mod) return null;
  const color = !mod.enabled ? "#5b6069" : mod.amount < 0 ? "#fb7185" : "#4ade80";
  return (
    <>
      <BaseEdge id={id} path={path} interactionWidth={0} style={{ stroke: color, strokeWidth: selected ? 2.5 : 1.5, strokeDasharray: "4 3" }} />
      <path
        d={path}
        ref={wheel}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        style={{ pointerEvents: "stroke", cursor: "ns-resize" }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      />
      {(hover || selected) && (
        <EdgeLabelRenderer>
          <div
            ref={wheel}
            className="nodrag nopan pointer-events-auto absolute rounded border border-neutral-700 bg-neutral-900 px-1 py-0.5 text-[9px] text-neutral-300"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
          >
            {mod.source} x {mod.amount.toFixed(2)} <span className="text-neutral-600">scroll</span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const edgeTypes = { mod: ModEdge };
