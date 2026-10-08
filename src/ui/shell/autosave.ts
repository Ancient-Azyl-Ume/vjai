import { useDoc } from "../../doc/store";
import { DocSchema } from "../../doc/schema";
import { readConfig, writeConfig } from "./config";
import { markClean } from "./session";
import { toast } from "./toast";

// Crash safety: the whole document is copied into the user config (config.json under
// Tauri, localStorage in the browser) 2s after the last edit and at least every 30s.
// It is not a file the user picks; `offerRestore` brings it back after a crash.
const DEBOUNCE = 2000;
const INTERVAL = 30000;

let timer: ReturnType<typeof setTimeout> | undefined;
let interval: ReturnType<typeof setInterval> | undefined;
let unsub: (() => void) | undefined;
let lastWritten = "";

async function write() {
  const doc = useDoc.getState().doc;
  const text = JSON.stringify(doc);
  if (text === lastWritten) return;
  lastWritten = text;
  try {
    await writeConfig({ autosave: { doc, at: Date.now(), name: doc.name } });
  } catch {
    // autosave must never interrupt a show
  }
}

export function startAutosave() {
  if (unsub) return;
  // Seed with the document as loaded: the crash copy in the config is only replaced once
  // this session has actually edited something. Without this the 30s tick would overwrite
  // a recovery copy the user has not looked at yet.
  lastWritten = JSON.stringify(useDoc.getState().doc);
  unsub = useDoc.subscribe((s, prev) => {
    if (s.doc === prev.doc) return;
    clearTimeout(timer);
    timer = setTimeout(write, DEBOUNCE);
  });
  interval = setInterval(write, INTERVAL);
}

export function stopAutosave() {
  unsub?.();
  unsub = undefined;
  clearTimeout(timer);
  if (interval) clearInterval(interval);
}

// Called once at startup: if the autosave is newer than the last explicit save and
// differs from what is loaded, offer it as a toast action. The offer never expires by
// itself (the user has to dismiss it) and it holds its own copy of the recovered
// document, so it stays valid even after this session's edits replace the config copy.
export async function offerRestore() {
  const cfg = await readConfig();
  const a = cfg.autosave;
  if (!a?.doc) return;
  if (a.at <= (cfg.lastSave?.at ?? 0)) return;
  if (JSON.stringify(a.doc) === JSON.stringify(useDoc.getState().doc)) return;
  const when = new Date(a.at).toLocaleString();
  toast(`unsaved work from ${when} ("${a.name}")`, "info", {
    sticky: true,
    label: "restore",
    run: async () => {
      const parsed = DocSchema.safeParse(a.doc);
      if (!parsed.success) return void toast("autosave is not a valid show", "error");
      await useDoc.getState().replace(parsed.data);
      markClean(cfg.lastSave?.path);
      toast("restored", "ok");
    },
  });
}
