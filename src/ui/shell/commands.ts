import { call, emitEvent, pickFile, pickSave } from "../../rpc";
import { useDoc, type Op } from "../../doc/store";
import { DocSchema, defaultDoc } from "../../doc/schema";
import { useUi } from "./uiStore";
import { VIDEO_STATUS } from "../../engine/sources/media";
import { addRecent, baseName, readConfig, writeConfig } from "./config";
import { IDENTIFY, markClean, useSession } from "./session";
import { toast } from "./toast";
import { focusPanel, resetLayout, togglePanel } from "./layout";

// Every shell action lives here so the top bar, the keyboard shortcuts and the
// native menu all run exactly the same code path.

const fail = (what: string) => (e: unknown) => toast(`${what}: ${e instanceof Error ? e.message : String(e)}`, "error");

export async function newShow() {
  if (useSession.getState().dirty && !window.confirm("Discard unsaved changes?")) return;
  await useDoc.getState().replace(defaultDoc()).catch(fail("new show"));
  markClean();
  toast("new show", "ok");
}

export async function openShow() {
  const path = await pickFile({ extensions: ["json"] });
  if (path) await openPath(path);
}

export async function openPath(path: string) {
  try {
    const raw = await call<unknown>("load_doc", { path });
    const parsed = DocSchema.safeParse(raw);
    // the host also broadcasts doc:changed; setting it here bumps `revision` so
    // Tweakpane panes rebuild instead of showing the previous show's values
    if (parsed.success) useDoc.setState({ doc: parsed.data, revision: useDoc.getState().revision + 1 });
    markClean(path);
    useSession.setState({ recent: await addRecent(path) });
    toast(`opened ${baseName(path)}`, "ok");
  } catch (e) {
    fail("open")(e);
  }
}

export async function saveShow(as = false) {
  const doc = useDoc.getState().doc;
  let path = useSession.getState().filePath;
  if (as || !path) path = (await pickSave(`${doc.name}.vjai.json`)) ?? undefined;
  if (!path) return;
  try {
    await call("save_doc", { path });
    markClean(path);
    useSession.setState({ recent: await addRecent(path) });
    await writeConfig({ lastSave: { path, at: Date.now() } });
    toast(`saved ${baseName(path)}`, "ok");
  } catch (e) {
    fail("save")(e);
  }
}

// Panic. The global flag drives the UI and the overlay in every projector window;
// the per-output flags make the engine itself stop drawing (src/engine/output/slice.ts).
// One patch batch, so it is a single undo step.
export function toggleBlackout() {
  const doc = useDoc.getState().doc;
  const on = !doc.blackout;
  const ops: Op[] = [{ op: "set", path: "blackout", value: on }];
  for (const o of doc.outputs) ops.push({ op: "set", path: `outputs.${o.id}.blackout`, value: on });
  useDoc.getState().patch(ops).catch(fail("blackout"));
}

export async function openAllOutputs() {
  const outs = useDoc.getState().doc.outputs;
  if (!outs.length) return void toast("no outputs configured", "error");
  for (const o of outs) await call("open_output", { outputId: o.id, monitor: o.monitor }).catch(fail(`open ${o.name}`));
}

export async function closeAllOutputs() {
  for (const o of useDoc.getState().doc.outputs) await call("close_output", { outputId: o.id }).catch(() => {});
  useSession.setState({ outputs: {} });
}

// Flash each open projector window with its name, and list the monitors in a toast.
export async function identifyMonitors() {
  await emitEvent(IDENTIFY);
  const mons = await call<{ index: number; name: string; width: number; height: number }[]>("list_monitors").catch(() => []);
  toast(mons.map((m) => `${m.index}: ${m.name} ${m.width}x${m.height}`).join("\n") || "no monitors");
}

// Space: pause/resume the selected video layer through the same transport fields the
// layers panel uses (`playing` + `startedAt`), so every window stays on the same frame.
export function togglePlaySelected() {
  const { doc, patch } = useDoc.getState();
  const id = useUi.getState().selectedLayer;
  const layer = doc.layers.find((l) => l.id === id) ?? doc.layers.find((l) => l.source.type === "video");
  if (!layer || layer.source.type !== "video") return void toast("no video layer selected", "info");
  const src = layer.source;
  const base = `layers.${layer.id}.source`;
  if (src.playing) {
    patch([{ op: "set", path: `${base}.playing`, value: false }]).catch(fail("pause"));
    toast(`${layer.name}: paused`);
  } else {
    // resume from the frame this window's decoder is holding
    const t = VIDEO_STATUS.get(layer.id)?.time ?? src.in;
    const rate = Math.max(0.0625, Math.abs(src.speed) || 1);
    const startedAt = Date.now() - ((t - src.in) / rate) * 1000;
    patch([
      { op: "set", path: `${base}.playing`, value: true },
      { op: "set", path: `${base}.startedAt`, value: startedAt },
    ]).catch(fail("play"));
    toast(`${layer.name}: playing`);
  }
}

// Undo/redo with a Tweakpane number field focused: blur it first so a typed value is committed
// as a normal edit. That commit is an async patch, so wait for it to land (the field fires a
// native `change` when it really did change) or undo would race the step it should be undoing.
export async function runHistory(dir: "undo" | "redo") {
  const el = document.activeElement;
  if (el instanceof HTMLInputElement && el.closest(".tp-txtv-num")) {
    let committed = false;
    const onChange = () => (committed = true);
    el.addEventListener("change", onChange);
    el.blur();
    el.removeEventListener("change", onChange);
    if (committed)
      await new Promise<void>((done) => {
        const timer = setTimeout(() => { un(); done(); }, 250);
        const un = useDoc.subscribe(() => { clearTimeout(timer); un(); done(); });
      });
  }
  await useDoc.getState()[dir]().catch(fail(dir));
}

export function toggleShortcuts() {
  useSession.setState({ shortcutsOpen: !useSession.getState().shortcutsOpen });
}

export async function loadRecent() {
  const cfg = await readConfig();
  useSession.setState({ recent: cfg.recent ?? [] });
}

// Native menu ids and keyboard shortcuts both land here. The menu accelerator and the
// keydown can arrive in the same tick on some platforms, so identical ids are deduped.
let last = { id: "", at: -1000 };
export function runCommand(id: string) {
  const now = performance.now();
  if (id === last.id && now - last.at < 25) return;
  last = { id, at: now };
  if (id.startsWith("open:")) return void openPath(id.slice(5));
  switch (id) {
    case "new": return void newShow();
    case "open": return void openShow();
    case "save": return void saveShow();
    case "save_as": return void saveShow(true);
    case "undo": return void runHistory("undo");
    case "redo": return void runHistory("redo");
    case "blackout": return toggleBlackout();
    case "play_pause": return togglePlaySelected();
    case "out:open_all": return void openAllOutputs();
    case "out:close_all": return void closeAllOutputs();
    case "out:identify": return void identifyMonitors();
    case "view:reset": return resetLayout();
    case "view:focus_preview": return focusPanel("preview");
    case "help:shortcuts": return toggleShortcuts();
  }
  // Anything else under "view:" is a panel id from the registry. This runs after the
  // switch so the named view commands above are reachable.
  if (id.startsWith("view:")) togglePanel(id.slice(5));
}
