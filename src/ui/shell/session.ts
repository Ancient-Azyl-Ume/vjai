import { create } from "zustand";
import { useDoc } from "../../doc/store";

// Shell-local session state: what file the show came from, whether it has unsaved
// edits, how the engine is doing, which output windows are alive. Never in the doc.
type Session = {
  filePath?: string;
  dirty: boolean;
  recent: string[];
  accent: string;
  previewScale: number;
  shortcutsOpen: boolean;
  fps: number;
  frameMs: number;
  // output id -> performance.now() of the last heartbeat from its window
  outputs: Record<string, number>;
  set: (p: Partial<Session>) => void;
};

export const useSession = create<Session>((set) => ({
  dirty: false,
  recent: [],
  accent: "#22d3ee",
  previewScale: 1,
  shortcutsOpen: false,
  fps: 0,
  frameMs: 0,
  outputs: {},
  set: (p) => set(p),
}));

// markClean() with no path means "this show has no file yet" (new show).
// The snapshot is what makes the dirty marker survive the host's own echo: Tauri
// broadcasts set_doc/load_doc back to the sending window too, and that doc:changed lands
// after markClean with an equal but freshly parsed object.
let cleanJson: string | null = null;
export function markClean(filePath?: string) {
  cleanJson = JSON.stringify(useDoc.getState().doc);
  useSession.setState({ dirty: false, filePath });
}

export function applyAccent(accent: string) {
  document.documentElement.style.setProperty("--accent", accent);
  useSession.setState({ accent });
}

// Any document change (local edit, agent edit, edit from another window) makes the show dirty.
let watching = false;
export function watchDirty() {
  if (watching) return;
  watching = true;
  useDoc.subscribe((s, prev) => {
    if (s.doc === prev.doc) return;
    // already dirty: nothing to decide, and no stringify on every slider tick
    if (useSession.getState().dirty) return;
    if (cleanJson !== null && JSON.stringify(s.doc) === cleanJson) return;
    useSession.setState({ dirty: true });
  });
}

export const OUTPUT_ALIVE = "vjai:output-alive";
export const IDENTIFY = "vjai:identify";
export const MENU = "menu";
