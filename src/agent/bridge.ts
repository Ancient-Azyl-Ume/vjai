import { create } from "zustand";
import { runTool } from "./tools";

// Claude Code mode: sidecar/mcp.js is a stdio MCP server that also listens on
// ws://127.0.0.1:4820. This app dials in as a client and runs the tool calls it
// forwards, so Claude Code drives the same show document the chat panel does.

const URL = "ws://127.0.0.1:4820";
const MAX_BACKOFF = 30000;

// Which window this is, so the sidecar can route tool calls to the main window and
// ignore projector windows (main.tsx routes on ?output=<id>).
const OUTPUT = new URLSearchParams(location.search).get("output");
const WINDOW_ID = OUTPUT ? `output-${OUTPUT}` : "main";

// "standby": connected, but another window is the one the sidecar routes calls to.
// The sidecar keeps every window attached and tells each one its role, so two open
// windows no longer knock each other off and reconnect in a loop. Projector windows
// always sit in standby: the sidecar never routes tools to them.
export type BridgeStatus = "off" | "connecting" | "connected" | "standby";

export const useBridge = create<{ status: BridgeStatus; lastTool?: string }>(() => ({ status: "off" }));

let ws: WebSocket | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let attempt = 0;
let want = false;

export function setBridgeEnabled(on: boolean) {
  want = on;
  clearTimeout(timer);
  if (!on) {
    const sock = ws;
    ws = undefined;
    sock?.close();
    useBridge.setState({ status: "off" });
    return;
  }
  attempt = 0;
  open();
}

function retry() {
  if (!want) return;
  attempt = Math.min(attempt + 1, 6);
  timer = setTimeout(open, Math.min(1000 * 2 ** attempt, MAX_BACKOFF));
}

function open() {
  if (!want || ws) return;
  useBridge.setState({ status: "connecting" });
  let sock: WebSocket;
  try {
    sock = new WebSocket(URL);
  } catch {
    retry();
    return;
  }
  ws = sock;
  sock.onopen = () => {
    attempt = 0;
    useBridge.setState({ status: "connected" });
    sock.send(JSON.stringify({ type: "hello", app: "vjai", window: WINDOW_ID }));
  };
  sock.onclose = () => {
    if (ws !== sock) return; // superseded or turned off
    ws = undefined;
    useBridge.setState({ status: "connecting" });
    retry();
  };
  // onerror is always followed by onclose; nothing to do here but keep it quiet
  sock.onerror = () => {};
  sock.onmessage = async (e) => {
    let msg: { type?: string; id?: string; name?: string; input?: unknown; active?: boolean };
    try {
      msg = JSON.parse(String(e.data));
    } catch {
      return;
    }
    if (msg.type === "role") {
      useBridge.setState({ status: msg.active ? "connected" : "standby" });
      return;
    }
    if (msg.type !== "call" || !msg.id || !msg.name) return;
    useBridge.setState({ lastTool: msg.name });
    try {
      const content = await runTool(msg.name, msg.input ?? {});
      // runTool reports failures in-band; tell the sidecar so it can flag them as MCP errors
      const ok = !(typeof content === "string" && content.startsWith("error"));
      sock.send(JSON.stringify({ type: "result", id: msg.id, ok, content }));
    } catch (err) {
      sock.send(JSON.stringify({ type: "result", id: msg.id, ok: false, content: String(err) }));
    }
  };
}
