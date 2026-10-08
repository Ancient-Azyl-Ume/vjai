#!/usr/bin/env node
// vjai MCP sidecar.
//
// stdio MCP server (for Claude Code) on one side, WebSocket server on 127.0.0.1:4820
// on the other. The running vjai window dials in as a WS client (src/agent/bridge.ts)
// and executes the tool calls; this process only forwards them.
//
//   claude mcp add vjai -- node /absolute/path/to/vjai/sidecar/mcp.js
//
// Tool schemas mirror src/agent/tools.ts. Keep them in sync.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.VJAI_BRIDGE_PORT || 4820);
const CALL_TIMEOUT = 15000;
const HELLO_TIMEOUT = 5000;

const TOOLS = [
  {
    name: "get_doc",
    description: "Return the whole current vjai show document (layers, effects, outputs, slices, mods, audio).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "patch_doc",
    description:
      "Apply patch ops to the show document. Paths are dotted and address arrays by element id, " +
      'e.g. "layers.L1.opacity", "layers.L1.effects" (add), "outputs.O1.slices.S1.corners". ' +
      'op is "set" (replace value at path), "add" (push value into the array at path) or "remove".',
    inputSchema: {
      type: "object",
      properties: {
        ops: {
          type: "array",
          items: {
            type: "object",
            properties: {
              op: { type: "string", enum: ["set", "add", "remove"] },
              path: { type: "string" },
              value: {},
            },
            required: ["op", "path"],
          },
        },
      },
      required: ["ops"],
    },
  },
  {
    name: "list_media",
    description: "List files in the show's media directory (or a given directory).",
    inputSchema: { type: "object", properties: { dir: { type: "string" } } },
  },
  {
    name: "snapshot",
    description: "Grab a JPEG of what the vjai preview is showing right now.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_signals",
    description: "Live audio analysis numbers (rms, bass, mid, high, kick), 0..1, plus whether the mic is running.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

// ---- WebSocket side: the apps connect to us ----
// Every open window stays attached; calls go to the best main one. Closing the older
// socket instead (the old "last one wins") made two windows reconnect at each other
// forever, because the app treats a close as a dropped connection.
// Each window says who it is in its hello ("main" or "output-<id>"). Projector windows
// never take tool calls: they have no preview to snapshot and no UI to select in.
const apps = [];
let nextId = 1;
let nextSeq = 1;
const pending = new Map();

// Routing rank. A hello that carries window === "main" beats a legacy hello with no
// window field, so a stale tab running an older build cannot outrank the real window
// just by being the newest connection. Rank 0 never takes calls.
const RANK_MAIN = 2;
const RANK_LEGACY = 1;
const RANK_NONE = 0;

function rank(sock) {
  if (sock.readyState !== 1 || !sock.helloSeen) return RANK_NONE;
  if (sock.windowId === undefined) return RANK_LEGACY;
  return String(sock.windowId).startsWith("output-") ? RANK_NONE : RANK_MAIN;
}

// Highest rank wins; among equals the most recent connection wins.
function active() {
  let best = null;
  let bestRank = RANK_NONE;
  for (const sock of apps) {
    const r = rank(sock);
    if (r > RANK_NONE && r >= bestRank) {
      best = sock;
      bestRank = r;
    }
  }
  return best;
}

let routeLabel = "none";

// Tell each window whether it is the one receiving calls, so it can say so in the UI,
// and log the chosen route whenever it changes.
function announceRoles() {
  const a = active();
  const label = a ? `${a.windowId ?? "legacy"} #${a.seq}` : "none";
  if (label !== routeLabel) {
    routeLabel = label;
    console.error(`[vjai] routing tool calls to ${label}`);
  }
  for (const sock of apps) {
    if (sock.readyState !== 1) continue;
    try {
      sock.send(JSON.stringify({ type: "role", active: sock === a }));
    } catch {
      // socket died between the check and the send; the close handler cleans up
    }
  }
}

const wss = new WebSocketServer({ host: "127.0.0.1", port: PORT });

wss.on("connection", (sock) => {
  sock.seq = nextSeq++;
  sock.helloSeen = false;
  // Something that never identifies itself is not a vjai window; drop it rather than
  // let it sit in the list forever.
  sock.helloTimer = setTimeout(() => {
    if (sock.helloSeen) return;
    console.error(`[vjai] socket #${sock.seq} sent no hello within ${HELLO_TIMEOUT / 1000}s, dropping`);
    sock.close();
  }, HELLO_TIMEOUT);
  apps.push(sock);
  console.error(`[vjai] app connected on ${PORT} (${apps.length} attached)`);
  // roles are announced once the window says hello: before that we do not know whether
  // it is the main window or a projector, and would tell a projector it is active
  sock.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (msg.type === "hello") {
      clearTimeout(sock.helloTimer);
      sock.helloSeen = true;
      // undefined windowId means a legacy hello with no window field: routable, but
      // outranked by any window that names itself "main"
      sock.windowId = typeof msg.window === "string" ? msg.window : undefined;
      console.error(`[vjai] socket #${sock.seq} identified as ${sock.windowId ?? "legacy (no window field)"}`);
      announceRoles();
      return;
    }
    if (msg.type !== "result") return;
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    clearTimeout(p.timer);
    p.resolve(msg);
  });
  sock.on("close", () => {
    clearTimeout(sock.helloTimer);
    const i = apps.indexOf(sock);
    if (i >= 0) apps.splice(i, 1);
    console.error(`[vjai] app disconnected (${apps.length} attached)`);
    announceRoles();
  });
  sock.on("error", () => {});
});

wss.on("error", (err) => {
  console.error(`[vjai] websocket server error: ${err.message}`);
});

function callApp(name, input) {
  const app = active();
  if (!app) {
    return Promise.reject(new Error(apps.length
      ? "no vjai main window is attached (only projector or unidentified sockets); tools run in the main window."
      : "vjai is not connected. Open the app (pnpm tauri dev) and make sure the chat panel's bridge toggle is on."));
  }
  const id = String(nextId++);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`vjai did not answer ${name} within ${CALL_TIMEOUT / 1000}s`));
    }, CALL_TIMEOUT);
    pending.set(id, { resolve, timer });
    app.send(JSON.stringify({ type: "call", id, name, input: input ?? {} }));
  }).then((msg) => {
    if (!msg.ok) throw new Error(String(msg.content));
    return msg.content;
  });
}

// The app answers with what the Anthropic SDK wants: a string, or content blocks.
// Translate that to MCP content.
function toMcpContent(content) {
  if (typeof content === "string") return [{ type: "text", text: content }];
  if (!Array.isArray(content)) return [{ type: "text", text: JSON.stringify(content) }];
  return content.map((b) =>
    b.type === "image"
      ? { type: "image", data: b.source.data, mimeType: b.source.media_type }
      : { type: "text", text: b.text ?? JSON.stringify(b) },
  );
}

// ---- MCP side: Claude Code talks to us over stdio ----
const server = new Server({ name: "vjai", version: "0.1.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params.name;
  if (!TOOLS.some((t) => t.name === name)) {
    return { content: [{ type: "text", text: `unknown tool: ${name}` }], isError: true };
  }
  try {
    // callApp rejects when the app reports a failed tool call, so every error path
    // below sets isError; otherwise a failed patch_doc would look like a success.
    const content = await callApp(name, req.params.arguments);
    return { content: toMcpContent(content) };
  } catch (e) {
    return { content: [{ type: "text", text: String(e.message ?? e) }], isError: true };
  }
});

await server.connect(new StdioServerTransport());
console.error(`[vjai] MCP sidecar ready, waiting for the app on ws://127.0.0.1:${PORT}`);
