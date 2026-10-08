import { useEffect, useRef } from "react";
import { Pane } from "tweakpane";
import { useDoc } from "../../doc/store";

// Tweakpane is vanilla; this hook gives a container and rebuilds the pane when deps change.
// Bindings hold local copies of doc values, so `build` returns a `pull` that copies the doc
// back into those copies. The hook runs it after every doc change and refreshes the pane.
//
// pane.refresh() re-reads the bound objects and fires a change event for every value that
// moved, so without a guard the refresh patches the doc from inside the doc subscription:
// extra history entries, lost redo, stale values written back over an undo. The refresh
// therefore runs with `syncing` set, and every pane change handler that writes to the doc must
// early-return on `paneSyncing()`: a change fired then is an echo of the doc, not an edit.
let syncing = false;

export const paneSyncing = () => syncing;

export function useTweakpane(build: (pane: Pane) => void | (() => void), deps: unknown[]) {
  const ref = useRef<HTMLDivElement>(null);
  const revision = useDoc((s) => s.revision);
  useEffect(() => {
    if (!ref.current) return;
    const pane = new Pane({ container: ref.current });
    const pull = build(pane);
    // While a pane control is held the doc trails the pointer; refreshing then would fight the drag.
    let dragging = false;
    let queued = false;
    const run = () => {
      queued = false;
      if (!pull || dragging) return;
      syncing = true;
      try {
        pull();
        pane.refresh();
      } finally {
        syncing = false;
      }
    };
    // Sync after the doc update settles, never inside the subscription that reported it.
    const schedule = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(run);
    };
    const onDown = () => { dragging = true; };
    const onUp = () => { if (dragging) { dragging = false; schedule(); } };
    pane.element.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    const un = useDoc.subscribe((s, prev) => { if (s.doc !== prev.doc) schedule(); });
    return () => {
      un();
      pane.element.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      pane.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, revision]);
  return ref;
}
