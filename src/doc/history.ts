import type { Doc } from "./schema";

// Undo/redo as doc snapshots. Docs are never mutated in place, so holding references is enough.
// Consecutive edits of the same single path within COALESCE_MS collapse into one step
// (a slider drag is one undo). Capped at MAX entries; any new edit clears redo.
const MAX = 200;
const COALESCE_MS = 400;

type Entry = { doc: Doc; key: string | null; at: number };

export function createHistory() {
  let undo: Entry[] = [];
  let redo: Entry[] = [];
  return {
    // `prev` is the doc before the edit; `key` null means never coalesce. `force` starts a new
    // step even when the key matches (a gesture boundary), while still letting what follows join it.
    push(prev: Doc, key: string | null, now = Date.now(), force = false) {
      redo = [];
      const last = undo[undo.length - 1];
      // Only repeated edits of one and the same path are a drag. A batch that touches several
      // paths (the store joins them with "|") always gets its own step.
      const drag = key && !key.includes("|") ? key : null;
      if (!force && drag && last && last.key === drag && now - last.at < COALESCE_MS) {
        last.at = now;
        return;
      }
      undo.push({ doc: prev, key: drag, at: now });
      if (undo.length > MAX) undo.shift();
    },
    undo(current: Doc): Doc | undefined {
      const e = undo.pop();
      if (!e) return;
      redo.push({ doc: current, key: null, at: 0 });
      return e.doc;
    },
    redo(current: Doc): Doc | undefined {
      const e = redo.pop();
      if (!e) return;
      undo.push({ doc: current, key: null, at: 0 });
      return e.doc;
    },
    canUndo: () => undo.length > 0,
    canRedo: () => redo.length > 0,
    clear() {
      undo = [];
      redo = [];
    },
  };
}
