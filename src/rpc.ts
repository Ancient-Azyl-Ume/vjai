// Everything the frontend needs from the host goes through here.
// Under Tauri it is `invoke`; in a plain browser (dev, e2e tests) the same calls are
// served in-page: the doc lives in memory and is shared between tabs via BroadcastChannel.
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export const isTauri = typeof (window as any).__TAURI_INTERNALS__ !== "undefined";

type Op = { op: "set" | "add" | "remove"; path: string; value?: unknown };

// ---- browser fallback state ----
const KEY = "vjai:doc";
const bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("vjai") : undefined;
const listeners = new Set<(doc: unknown) => void>();
bc?.addEventListener("message", (e) => {
  if (e.data?.type === "doc:changed") {
    sessionStorage.setItem(KEY, JSON.stringify(e.data.doc));
    listeners.forEach((l) => l(e.data.doc));
  }
});

function readDoc(): unknown {
  const t = localStorage.getItem(KEY);
  return t ? JSON.parse(t) : null;
}
function writeDoc(doc: unknown) {
  localStorage.setItem(KEY, JSON.stringify(doc));
  bc?.postMessage({ type: "doc:changed", doc });
  listeners.forEach((l) => l(doc));
}

function step(v: any, seg: string): any {
  if (Array.isArray(v)) {
    const i = Number(seg);
    return Number.isInteger(i) ? v[i] : v.find((e) => e?.id === seg);
  }
  return v?.[seg];
}

// Mirrors apply_op in src-tauri/src/lib.rs.
function applyOp(doc: any, op: Op): any {
  const segs = op.path.split(".").filter(Boolean);
  if (segs.length === 0) {
    if (op.op === "set") return op.value;
    throw new Error("empty path");
  }
  const last = segs[segs.length - 1];
  let cur = doc;
  for (const s of segs.slice(0, -1)) {
    cur = step(cur, s);
    if (cur == null) throw new Error(`path not found: ${op.path} (at ${s})`);
  }
  if (op.op === "set") {
    if (Array.isArray(cur)) {
      const i = Number(last);
      const idx = Number.isInteger(i) ? i : cur.findIndex((e: any) => e?.id === last);
      if (idx < 0) throw new Error(`index not found: ${op.path}`);
      cur[idx] = op.value;
    } else cur[last] = op.value;
  } else if (op.op === "add") {
    const t = step(cur, last);
    if (!Array.isArray(t)) throw new Error(`add target is not an array: ${op.path}`);
    t.push(op.value);
  } else if (op.op === "remove") {
    if (Array.isArray(cur)) {
      const i = Number(last);
      if (Number.isInteger(i)) cur.splice(i, 1);
      else {
        const idx = cur.findIndex((e: any) => e?.id === last);
        if (idx >= 0) cur.splice(idx, 1);
      }
    } else delete cur[last];
  } else throw new Error(`unknown op: ${op.op}`);
  return doc;
}

// Projector popups opened by this window, so "close all outputs" (Esc) can shut them.
// Only popups this tab opened are reachable: one opened from another tab has to be closed
// by hand, and after a reload the handles are gone.
const outputWindows = new Map<string, Window>();
function closeOutputWindow(id: string): boolean {
  const w = outputWindows.get(id);
  outputWindows.delete(id);
  if (!w || w.closed) return false;
  w.close();
  return true;
}

const browser: Record<string, (args: any) => Promise<any>> = {
  get_doc: async () => readDoc(),
  set_doc: async ({ doc }) => writeDoc(doc),
  patch_doc: async ({ ops }) => {
    let doc = JSON.parse(JSON.stringify(readDoc()));
    for (const op of ops as Op[]) doc = applyOp(doc, op);
    writeDoc(doc);
    return doc;
  },
  list_monitors: async () => [{ index: 0, name: "browser", x: 0, y: 0, width: screen.width, height: screen.height, scale: devicePixelRatio }],
  open_output: async ({ outputId }) => {
    const w = window.open(`${location.pathname}?output=${outputId}`, `vjai-output-${outputId}`, "popup,width=960,height=540");
    if (w) outputWindows.set(String(outputId), w);
  },
  close_output: async ({ outputId }) => { closeOutputWindow(String(outputId)); },
  save_doc: async ({ path }) => { localStorage.setItem("vjai:file:" + path, JSON.stringify(readDoc())); },
  load_doc: async ({ path }) => { const t = localStorage.getItem("vjai:file:" + path); if (!t) throw new Error("not found"); const d = JSON.parse(t); writeDoc(d); return d; },
  list_dir: async () => [],
  get_config: async () => JSON.parse(localStorage.getItem("vjai:config") ?? "{}"),
  set_config: async ({ config }) => localStorage.setItem("vjai:config", JSON.stringify(config)),
  log_line: async ({ line }) => console.log("[vjai]", line),
  close_all_outputs: async () => {
    let n = 0;
    for (const id of [...outputWindows.keys()]) if (closeOutputWindow(id)) n++;
    return n;
  },
  identify_monitors: async () => {
    const w = window.open(`identify.html?i=0&w=${screen.width}&h=${screen.height}`, "vjai-identify", "popup,width=480,height=270");
    setTimeout(() => w?.close(), 2000);
  },
};

export function call<T = unknown>(name: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) return invoke<T>(name, args);
  const fn = browser[name];
  if (!fn) return Promise.reject(new Error("no browser fallback for " + name));
  return fn(args ?? {});
}

export async function onDocChanged(cb: (doc: unknown) => void): Promise<() => void> {
  if (isTauri) {
    const un = await listen<unknown>("doc:changed", (e) => cb(e.payload));
    return un;
  }
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// Dialogs: the plugin only exists under Tauri; in the browser use a prompt so flows stay testable.
export async function pickFile(opts: { directory?: boolean; extensions?: string[] }): Promise<string | null> {
  if (isTauri) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const r = await open({ multiple: false, directory: opts.directory, filters: opts.extensions ? [{ name: "files", extensions: opts.extensions }] : undefined });
    return r ? String(r) : null;
  }
  return window.prompt(opts.directory ? "directory path" : "file path") || null;
}

export async function pickSave(defaultPath: string): Promise<string | null> {
  if (isTauri) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    return (await save({ defaultPath, filters: [{ name: "vjai show", extensions: ["json"] }] })) ?? null;
  }
  return window.prompt("save as", defaultPath) || null;
}

// ---- generic app events ----
// Cross-window signals that are not the document: native menu actions, output-window
// heartbeats, "identify monitors". Tauri emits app-wide; the browser uses the same
// BroadcastChannel (and delivers to the sender too, like Tauri does).
const evtListeners = new Map<string, Set<(p: any) => void>>();
bc?.addEventListener("message", (e) => {
  const d = e.data;
  if (d && typeof d.evt === "string") evtListeners.get(d.evt)?.forEach((f) => f(d.payload));
});

export async function emitEvent(name: string, payload?: unknown): Promise<void> {
  if (isTauri) {
    const { emit } = await import("@tauri-apps/api/event");
    await emit(name, payload);
    return;
  }
  bc?.postMessage({ evt: name, payload });
  evtListeners.get(name)?.forEach((f) => f(payload));
}

export async function onEvent<T = unknown>(name: string, cb: (p: T) => void): Promise<() => void> {
  if (isTauri) return listen<T>(name, (e) => cb(e.payload));
  let s = evtListeners.get(name);
  if (!s) evtListeners.set(name, (s = new Set()));
  s.add(cb as (p: any) => void);
  return () => { s!.delete(cb as (p: any) => void); };
}

export function fileUrl(path: string): string {
  if (isTauri) return convertFileSrc(path);
  return path; // browser: use an http(s) URL or a path served by vite
}
