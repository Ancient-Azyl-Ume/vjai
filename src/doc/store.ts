import { create } from "zustand";
import { call, onDocChanged } from "../rpc";
import { DocSchema, defaultDoc, getPath, type Doc } from "./schema";
import { createHistory } from "./history";

export type Op = { op: "set" | "add" | "remove"; path: string; value?: unknown };

type DocStore = {
  doc: Doc;
  ready: boolean;
  canUndo: boolean;
  canRedo: boolean;
  // bumped when the doc is replaced wholesale (undo, redo, load) so panes holding local copies rebuild
  revision: number;
  // `coalesce` false forces a new undo step even when the previous edit touched the same path
  // (a gesture boundary: pointer down, pointer up, a keyboard nudge after a drag).
  patch: (ops: Op[], coalesce?: boolean) => Promise<void>;
  set: (path: string, value: unknown) => Promise<void>;
  replace: (doc: Doc) => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
};

const history = createHistory();
const flags = () => ({ canUndo: history.canUndo(), canRedo: history.canRedo() });

// Optional guard the UI installs (src/ui/hooks/useAssignTarget.ts): while a mod is armed
// for "assign", touching a parameter routes it to that mod instead of editing it.
let intercept: ((doc: Doc, path: string, value: unknown) => boolean) | null = null;
export function setSetInterceptor(fn: typeof intercept) {
  intercept = fn;
}

// Only pure `set` batches coalesce (a dragged slider); adds/removes are always their own step.
function coalesceKey(ops: Op[]): string | null {
  return ops.every((o) => o.op === "set") ? ops.map((o) => o.path).join("|") : null;
}

// Post-patch cleanup: a mod whose target no longer resolves (its layer, effect or macro was
// removed) is dropped. The check is on the target's PARENT, because effect params only appear
// in the doc once touched - an untouched param is not a dangling target.
// Applied inside the same patch call, so one undo brings the target and its mods back together.
function danglingModOps(doc: Doc): Op[] {
  const ops: Op[] = [];
  for (const m of doc.mods) {
    const i = m.target.lastIndexOf(".");
    if (i < 0) continue; // no target yet: the row is waiting for an assign
    const parent = getPath(doc, m.target.slice(0, i));
    if (parent == null || typeof parent !== "object") ops.push({ op: "remove", path: `mods.${m.id}` });
  }
  return ops;
}

export const useDoc = create<DocStore>((set, get) => ({
  doc: defaultDoc(),
  ready: false,
  canUndo: false,
  canRedo: false,
  revision: 0,
  patch: async (ops, coalesce = true) => {
    const prev = get().doc;
    let next = DocSchema.parse(await call<unknown>("patch_doc", { ops }));
    const cleanup = danglingModOps(next);
    if (cleanup.length) next = DocSchema.parse(await call<unknown>("patch_doc", { ops: cleanup }));
    history.push(prev, cleanup.length ? null : coalesceKey(ops), Date.now(), !coalesce);
    set({ doc: next, ...flags() });
  },
  set: (path, value) => (intercept?.(get().doc, path, value) ? Promise.resolve() : get().patch([{ op: "set", path, value }])),
  replace: async (doc) => {
    const prev = get().doc;
    await call("set_doc", { doc });
    history.push(prev, null);
    set({ doc, revision: get().revision + 1, ...flags() });
  },
  // Undo/redo go through set_doc so every window follows.
  undo: async () => {
    const doc = history.undo(get().doc);
    if (!doc) return;
    await call("set_doc", { doc });
    set({ doc, revision: get().revision + 1, ...flags() });
  },
  redo: async () => {
    const doc = history.redo(get().doc);
    if (!doc) return;
    await call("set_doc", { doc });
    set({ doc, revision: get().revision + 1, ...flags() });
  },
}));

// Bootstrap: pull the doc from Rust (seed it if this is the first window) and follow changes.
export async function connectDoc() {
  const current = await call<unknown>("get_doc");
  if (current == null) {
    const d = defaultDoc();
    await call("set_doc", { doc: d });
    useDoc.setState({ doc: d, ready: true });
  } else {
    useDoc.setState({ doc: DocSchema.parse(current), ready: true });
  }
  await onDocChanged((payload) => {
    const parsed = DocSchema.safeParse(payload);
    if (parsed.success) useDoc.setState({ doc: parsed.data });
    else console.warn("doc:changed failed schema", parsed.error);
  });
}
