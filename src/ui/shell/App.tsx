import { useEffect, useState } from "react";
import { DockviewReact, type DockviewReadyEvent, type IDockviewPanelProps } from "dockview-react";
import { onEvent } from "../../rpc";
import { useDoc } from "../../doc/store";
import { useUi } from "./uiStore";
import { PANELS } from "../panels/registry";
import { useAssignStore } from "../hooks/useAssignTarget";
import { setBridgeEnabled } from "../../agent/bridge";
import { getEngine } from "../hooks/useEngine";
import { Menu, type MenuItem } from "./Menu";
import { Toasts } from "./Toasts";
import { ShortcutsOverlay } from "./ShortcutsOverlay";
import { toast } from "./toast";
import { buildDefault, isPanelOpen, restoreLayout, saveLayout, setLayoutApi } from "./layout";
import { MENU, OUTPUT_ALIVE, applyAccent, useSession, watchDirty } from "./session";
import { baseName, readConfig } from "./config";
import { offerRestore, startAutosave } from "./autosave";
import * as cmd from "./commands";

const components: Record<string, React.FC<IDockviewPanelProps>> = Object.fromEntries(
  PANELS.map((p) => [p.id, p.component as React.FC<IDockviewPanelProps>]),
);

// Typing in a field must not trigger app shortcuts (inputs, textareas, Tweakpane text fields).
function inTextField(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
}

// A Tweakpane number field is a text input holding a number: Cmd+Z there means undo the show,
// not the browser's text undo. Real text fields (name, chat, string params) keep the native one.
const isNumberField = (t: EventTarget | null) => t instanceof HTMLInputElement && !!t.closest(".tp-txtv-num");

export function App() {
  const doc = useDoc((s) => s.doc);
  const ready = useDoc((s) => s.ready);
  const canUndo = useDoc((s) => s.canUndo);
  const canRedo = useDoc((s) => s.canRedo);
  const session = useSession();
  const [renaming, setRenaming] = useState(false);
  const [layoutTick, setLayoutTick] = useState(0);
  const audioOn = useUi((s) => s.audioOn);
  const outputsOpen = Object.keys(session.outputs).length;

  const onReady = (e: DockviewReadyEvent) => {
    const api = e.api;
    setLayoutApi(api);
    if (!restoreLayout(api)) buildDefault(api);
    api.onDidLayoutChange(() => { saveLayout(); setLayoutTick((t) => t + 1); });
    api.onDidActivePanelChange((ev) => ev?.panel && useUi.getState().set({ activePanel: ev.panel.id }));
  };

  // boot: prefs, recent list, autosave, dirty tracking
  useEffect(() => {
    if (!ready) return;
    watchDirty();
    startAutosave();
    void cmd.loadRecent();
    void readConfig().then((c) => {
      if (c.accent) applyAccent(c.accent);
      if (typeof c.previewScale === "number") useSession.setState({ previewScale: c.previewScale });
      // the Claude Code bridge lives as long as the window, not just while the chat panel is open
      if (c.bridge !== false) setBridgeEnabled(true);
    });
    void offerRestore();
  }, [ready]);

  // uncaught errors (shader compiles, host calls) become toasts instead of vanishing into the console
  useEffect(() => {
    const onErr = (e: ErrorEvent) => toast(e.message, "error");
    const onRej = (e: PromiseRejectionEvent) => toast(String(e.reason), "error");
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => { window.removeEventListener("error", onErr); window.removeEventListener("unhandledrejection", onRej); };
  }, []);

  // fps / frame-ms HUD: time the engine's own frame call, sample twice a second
  useEffect(() => {
    if (!ready) return;
    let eng;
    try { eng = getEngine(); } catch (e) { toast(`engine: ${String(e)}`, "error"); return; }
    const orig = eng.frame.bind(eng);
    let frames = 0, work = 0, last = performance.now();
    eng.frame = () => { const t0 = performance.now(); orig(); work += performance.now() - t0; frames++; };
    const iv = setInterval(() => {
      const now = performance.now();
      useSession.setState({ fps: Math.round((frames * 1000) / (now - last)), frameMs: frames ? Math.round((work / frames) * 10) / 10 : 0 });
      frames = 0; work = 0; last = now;
    }, 500);
    return () => { clearInterval(iv); eng.frame = orig; };
  }, [ready]);

  // projector windows announce themselves once a second; anything older than 3s is gone
  useEffect(() => {
    let un = () => {};
    void onEvent<{ id: string }>(OUTPUT_ALIVE, (p) => {
      if (p?.id) useSession.setState((s) => ({ outputs: { ...s.outputs, [p.id]: performance.now() } }));
    }).then((f) => (un = f));
    const iv = setInterval(() => {
      const now = performance.now();
      const cur = useSession.getState().outputs;
      const next = Object.fromEntries(Object.entries(cur).filter(([, t]) => now - t < 3000));
      if (Object.keys(next).length !== Object.keys(cur).length) useSession.setState({ outputs: next });
    }, 1500);
    return () => { un(); clearInterval(iv); };
  }, []);

  // native menu -> the same commands the buttons run
  useEffect(() => {
    let un = () => {};
    void onEvent<string>(MENU, (id) => cmd.runCommand(id)).then((f) => (un = f));
    return () => un();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        const k = e.key.toLowerCase();
        if (k === "s") { e.preventDefault(); cmd.runCommand(e.shiftKey ? "save_as" : "save"); }
        else if (k === "o") { e.preventDefault(); cmd.runCommand("open"); }
        else if (k === "n") { e.preventDefault(); cmd.runCommand("new"); }
        else if (k === "z" && (!inTextField(e) || isNumberField(e.target))) { e.preventDefault(); cmd.runCommand(e.shiftKey ? "redo" : "undo"); }
        return;
      }
      if (e.key === "Escape") {
        if (useSession.getState().shortcutsOpen) useSession.setState({ shortcutsOpen: false });
        // text fields and the mods panel's assign mode own their own Escape
        else if (!inTextField(e) && !useAssignStore.getState().armed) cmd.runCommand("out:close_all");
        return;
      }
      if (inTextField(e)) return;
      if (e.key === "?") { e.preventDefault(); cmd.runCommand("help:shortcuts"); }
      else if (e.key === " ") { e.preventDefault(); cmd.runCommand("play_pause"); }
      else if (e.key.toLowerCase() === "b") cmd.runCommand("blackout");
      else if (e.key.toLowerCase() === "f") cmd.runCommand("out:open_all");
      // 1..8 (and shift+1..8) belong to the deck panel
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const fileItems: MenuItem[] = [
    { label: "new show", hint: "Cmd N", run: () => cmd.runCommand("new") },
    { label: "open show...", hint: "Cmd O", run: () => cmd.runCommand("open") },
    { label: "save", hint: "Cmd S", run: () => cmd.runCommand("save") },
    { label: "save as...", hint: "Cmd Shift S", run: () => cmd.runCommand("save_as") },
    "-",
    ...(session.recent.length
      ? session.recent.map((p) => ({ label: baseName(p), hint: "recent", run: () => cmd.openPath(p) }))
      : [{ label: "no recent shows", run: () => {}, disabled: true }]),
  ];

  const viewItems: MenuItem[] = [
    ...PANELS.map((p) => ({ label: p.title, checked: isPanelOpen(p.id), run: () => cmd.runCommand(`view:${p.id}`) })),
    "-",
    { label: "reset layout", run: () => cmd.runCommand("view:reset") },
    { label: "keyboard shortcuts", hint: "?", run: () => cmd.runCommand("help:shortcuts") },
  ];

  const outputItems: MenuItem[] = [
    { label: "open all outputs", hint: "F", run: () => cmd.runCommand("out:open_all") },
    { label: "close all outputs", hint: "Esc", run: () => cmd.runCommand("out:close_all") },
    { label: "identify monitors", run: () => cmd.runCommand("out:identify") },
    "-",
    { label: doc.blackout ? "blackout is ON" : "blackout", hint: "B", checked: doc.blackout, run: () => cmd.runCommand("blackout") },
  ];
  void layoutTick; // viewItems are rebuilt whenever the dockview layout changes

  if (!ready) return <div className="p-4 text-neutral-500">connecting...</div>;
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-2 h-8 border-b border-neutral-800 text-xs select-none">
        <span className="font-semibold tracking-wide" style={{ color: "var(--accent)" }}>vjai</span>
        <Menu label="file" items={fileItems} />
        <Menu label="view" items={viewItems} />
        <Menu label="output" items={outputItems} />
        <span className="w-px h-3 bg-neutral-800" />
        {renaming ? (
          <input
            autoFocus
            defaultValue={doc.name}
            className="bg-neutral-800 rounded px-1 outline-none"
            onBlur={(e) => { setRenaming(false); if (e.target.value.trim()) void useDoc.getState().set("name", e.target.value.trim()); }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setRenaming(false); }}
          />
        ) : (
          <button className="text-neutral-300 hover:text-white" title="click to rename" onClick={() => setRenaming(true)}>{doc.name}</button>
        )}
        <span className="text-neutral-600" title={session.filePath ?? "not saved to a file yet"}>
          {session.dirty ? "*" : ""}{session.filePath ? ` ${baseName(session.filePath)}` : " (unsaved)"}
        </span>

        <span className="flex-1" />

        <button className="text-neutral-400 hover:text-white disabled:text-neutral-700" onClick={() => cmd.runCommand("undo")} disabled={!canUndo} title="undo (Cmd/Ctrl+Z)">undo</button>
        <button className="text-neutral-400 hover:text-white disabled:text-neutral-700" onClick={() => cmd.runCommand("redo")} disabled={!canRedo} title="redo (Cmd/Ctrl+Shift+Z)">redo</button>
        <span className="w-px h-3 bg-neutral-800" />
        <span className="font-mono text-neutral-500 tabular-nums" title="frames per second / engine time per frame">{session.fps} fps {session.frameMs}ms</span>
        <span className={audioOn ? "text-emerald-400" : "text-neutral-600"} title="audio input">audio</span>
        <span className={outputsOpen ? "text-emerald-400" : "text-neutral-600"} title="projector windows alive">out {outputsOpen}/{doc.outputs.length}</span>
        <button className="px-1.5 py-0.5 rounded text-neutral-400 hover:text-white" title="keyboard shortcuts (?)" onClick={() => cmd.runCommand("help:shortcuts")}>?</button>
        <button
          className={`px-2 py-0.5 rounded border ${doc.blackout ? "bg-rose-700 border-rose-500 text-white" : "border-neutral-700 text-neutral-300 hover:bg-neutral-800"}`}
          title="black all outputs (B)"
          onClick={() => cmd.runCommand("blackout")}
        >
          {doc.blackout ? "BLACKOUT" : "panic"}
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <DockviewReact className="dockview-theme-vjai h-full" components={components} onReady={onReady} />
      </div>
      <Toasts />
      <ShortcutsOverlay />
    </div>
  );
}
