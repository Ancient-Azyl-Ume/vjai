import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { call } from "../../rpc";
import { useDoc } from "../../doc/store";
import type { Doc } from "../../doc/schema";
import { agent, EFFORTS, MODELS, type ChatEvent, type Effort, type Model } from "../../agent/agent";
import { setBridgeEnabled, useBridge } from "../../agent/bridge";
import { grabSnapshot } from "../../agent/tools";
import { writeConfig } from "../shell/config";
import { useUi } from "../shell/uiStore";

type ToolCard = { id: string; name: string; lines: string[]; status: "run" | "ok" | "err"; message?: string };
type Msg = {
  role: "user" | "assistant";
  text: string;
  tools?: ToolCard[];
  // one human line, with the raw API text kept in a collapsible
  errors?: { message: string; detail?: string }[];
  // the document as it was before this turn, so the whole turn can be reverted in one click
  before?: Doc;
  undone?: boolean;
};

const QUICK = [
  "make it pulse to the kick",
  "calibrate outputs",
  "explain current setup",
];

const MCP_CMD = "claude mcp add vjai -- node <repo>/sidecar/mcp.js";

async function patchConfig(p: Record<string, unknown>) {
  await writeConfig(p);
}

export function ChatPanel() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [settings, setSettings] = useState(false);
  const [model, setModel] = useState<Model>(agent.model);
  const [effort, setEffort] = useState<Effort>(agent.effort);
  const [attach, setAttach] = useState(false);
  const [bridgeOn, setBridgeOn] = useState(true);
  const bridge = useBridge((s) => s.status);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    call<{ apiKey?: string; model?: Model; effort?: Effort; bridge?: boolean }>("get_config").then((c) => {
      if (c.apiKey) {
        agent.configure(c.apiKey);
        setHasKey(true);
      } else setSettings(true);
      if (c.model && MODELS.includes(c.model)) { agent.model = c.model; setModel(c.model); }
      if (c.effort && EFFORTS.includes(c.effort)) { agent.effort = c.effort; setEffort(c.effort); }
      const on = c.bridge !== false;
      setBridgeOn(on);
      setBridgeEnabled(on);
    });
  }, []);

  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }); }, [msgs]);

  const saveKey = async () => {
    const k = keyInput.trim();
    await patchConfig({ apiKey: k });
    agent.configure(k);
    setHasKey(!!k);
    setKeyInput("");
  };

  const pickModel = (m: Model) => { agent.model = m; setModel(m); patchConfig({ model: m }); };
  const pickEffort = (e: Effort) => { agent.effort = e; setEffort(e); patchConfig({ effort: e }); };
  const toggleBridge = () => { const on = !bridgeOn; setBridgeOn(on); setBridgeEnabled(on); patchConfig({ bridge: on }); };

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    if (raw === undefined) setInput("");
    setBusy(true);
    const before = useDoc.getState().doc;
    setMsgs((m) => [...m, { role: "user", text }, { role: "assistant", text: "", tools: [], errors: [], before }]);

    const onEvent = (e: ChatEvent) =>
      setMsgs((m) => {
        const last = { ...m[m.length - 1] };
        if (e.type === "text") last.text += e.delta;
        else if (e.type === "tool") last.tools = [...(last.tools ?? []), { id: e.id, name: e.name, lines: e.detail, status: "run" }];
        else if (e.type === "tool_end")
          last.tools = (last.tools ?? []).map((t) => (t.id === e.id ? { ...t, status: e.ok ? "ok" : "err", message: e.message } : t));
        else if (e.type === "error") last.errors = [...(last.errors ?? []), { message: e.message, detail: e.detail }];
        return [...m.slice(0, -1), last];
      });

    const ui = useUi.getState();
    await agent.send(
      text,
      {
        activePanel: ui.activePanel,
        selectedLayer: ui.selectedLayer,
        selectedOutput: ui.selectedOutput,
        selectedSlice: ui.selectedSlice,
        signals: ui.engine ? { ...ui.engine.audio.signals } : undefined,
        // grabSnapshot gives up after 2s; engine.snapshot() alone would hang the turn
        // whenever no preview view is registered or the window is not painting.
        snapshot: grabSnapshot,
      },
      attach,
      onEvent,
    );
    setBusy(false);
  };

  const undoTurn = async (i: number) => {
    const before = msgs[i].before;
    if (!before) return;
    await useDoc.getState().replace(before);
    setMsgs((m) => m.map((x, j) => (j === i ? { ...x, undone: true } : x)));
  };

  const dot =
    bridge === "connected" ? "bg-emerald-400"
    : bridge === "standby" ? "bg-sky-500"
    : bridge === "connecting" ? "bg-amber-500"
    : "bg-neutral-600";

  return (
    <div className="h-full flex flex-col text-xs">
      <div className="p-1.5 border-b border-neutral-800 flex items-center gap-1.5 flex-wrap">
        <button
          className="flex items-center gap-1 text-neutral-400 hover:text-neutral-200"
          onClick={toggleBridge}
          title={bridge === "standby" ? "Claude Code bridge: another window is taking the calls" : "Claude Code bridge (MCP sidecar on 127.0.0.1:4820)"}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
          bridge: {bridgeOn ? bridge : "off"}
        </button>
        <div className="flex-1" />
        <select className="bg-neutral-900 border border-neutral-700 rounded px-1 py-0.5" value={model} onChange={(e) => pickModel(e.target.value as Model)}>
          {MODELS.map((m) => <option key={m} value={m}>{m.replace("claude-", "")}</option>)}
        </select>
        <select className="bg-neutral-900 border border-neutral-700 rounded px-1 py-0.5" value={effort} onChange={(e) => pickEffort(e.target.value as Effort)}>
          {EFFORTS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <button className={`px-1.5 py-0.5 rounded border ${attach ? "bg-sky-900/60 border-sky-700" : "bg-neutral-900 border-neutral-700"}`} onClick={() => setAttach(!attach)} title="attach a preview snapshot to each message">
          snap
        </button>
        <button className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700" onClick={() => setSettings(!settings)}>key</button>
        <button className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700" onClick={() => { agent.reset(); setMsgs([]); }}>clear</button>
      </div>

      {settings && (
        <div className="p-2 border-b border-neutral-800 space-y-1.5">
          <div className="flex gap-1">
            <input
              type="password"
              className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1"
              placeholder={hasKey ? "key saved - type a new one to replace" : "ANTHROPIC_API_KEY"}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveKey(); }}
            />
            <button className="px-2 rounded bg-neutral-800 border border-neutral-700" onClick={saveKey}>save</button>
          </div>
          <div className="text-[10px] text-neutral-500 leading-relaxed">
            Claude Code mode: run the MCP sidecar and this panel is optional - Claude Code gets the same tools.
            <div className="font-mono text-neutral-400 mt-0.5 break-all">{MCP_CMD}</div>
          </div>
        </div>
      )}

      <div ref={list} className="flex-1 overflow-auto p-2 space-y-3">
        {msgs.length === 0 && (
          <div className="text-neutral-500">
            Tell me what to do with the picture. I edit the show document directly - every turn can be undone.
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-sky-200" : "text-neutral-200"}>
            <div className="text-[10px] uppercase text-neutral-500 mb-0.5 flex items-center gap-2">
              {m.role}
              {/* only offer the undo when a patch actually landed */}
              {m.role === "assistant" && m.before && m.tools?.some((t) => t.name === "patch_doc" && t.status === "ok") && (
                <button
                  className="normal-case text-neutral-500 hover:text-neutral-200 disabled:opacity-40"
                  disabled={m.undone}
                  onClick={() => undoTurn(i)}
                >
                  {m.undone ? "undone" : "undo this"}
                </button>
              )}
            </div>
            {m.tools?.map((t) => (
              <div key={t.id} className="mb-1 rounded border border-neutral-800 bg-neutral-900/60 px-1.5 py-1">
                <div className="flex items-center gap-1 font-mono text-[10px] text-amber-400/80">
                  <span>{t.status === "run" ? "◌" : t.status === "ok" ? "●" : "✕"}</span>
                  {t.name}
                </div>
                {t.lines.map((l, j) => (
                  <div key={j} className="font-mono text-[10px] text-neutral-400 pl-3 break-all">{l}</div>
                ))}
                {t.status === "err" && <div className="font-mono text-[10px] text-rose-400 pl-3 break-all">{t.message}</div>}
              </div>
            ))}
            <div className="prose prose-invert prose-xs max-w-none [&_p]:my-1"><ReactMarkdown>{m.text}</ReactMarkdown></div>
            {m.errors?.map((e, j) => (
              <div key={j} className="mt-1 rounded border border-rose-900 bg-rose-950/40 text-rose-300 px-1.5 py-1">
                <div className="break-words">{e.message}</div>
                {e.detail && e.detail !== e.message && (
                  <details className="mt-0.5">
                    <summary className="cursor-pointer text-[10px] text-rose-400/70">details</summary>
                    <div className="font-mono text-[10px] text-rose-400/80 break-all whitespace-pre-wrap">{e.detail}</div>
                  </details>
                )}
              </div>
            ))}
          </div>
        ))}
        {busy && <div className="text-neutral-500 animate-pulse">…</div>}
      </div>

      <div className="px-2 pt-1.5 flex gap-1 flex-wrap">
        {QUICK.map((q) => (
          <button
            key={q}
            className="px-1.5 py-0.5 rounded-full border border-neutral-700 text-[10px] text-neutral-400 hover:bg-neutral-800 disabled:opacity-40"
            disabled={busy}
            onClick={() => send(q)}
          >
            {q}
          </button>
        ))}
      </div>

      <div className="p-2 flex gap-1">
        <textarea
          className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 resize-none h-14"
          placeholder="tell me what to do with the picture..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button className="px-2 py-1 rounded bg-sky-800 hover:bg-sky-700 disabled:opacity-40 self-stretch" onClick={() => send()} disabled={busy}>send</button>
      </div>
    </div>
  );
}
