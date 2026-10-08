# vjai MCP sidecar

Lets **Claude Code** (or any MCP client) drive a running vjai show, so you can use your
Claude subscription instead of putting an API key in the chat panel.

```
Claude Code  --stdio MCP-->  sidecar/mcp.js  --ws://127.0.0.1:4820-->  vjai window
```

`mcp.js` is a stdio MCP server *and* a WebSocket server. It holds no state and does no
work of its own: the vjai window connects to it (`src/agent/bridge.ts`) and runs every
tool call through the same code path as the in-app chat agent (`src/agent/tools.ts`).

## Setup

```bash
cd sidecar           # from the repo root
pnpm install

claude mcp add vjai -- node "$(pwd)/mcp.js"   # absolute path to sidecar/mcp.js
```

Then, in this order:

1. Start the app: `pnpm tauri dev` (or open http://localhost:1420 in a browser).
2. Make sure the chat panel's `bridge:` indicator is green. If it says `off`, click it.
3. Start Claude Code. `claude mcp list` should show `vjai`, and the tools appear as
   `mcp__vjai__get_doc`, `mcp__vjai__patch_doc`, and so on.

Remove it again with `claude mcp remove vjai`. To check the server boots on its own:

```bash
node sidecar/mcp.js      # prints "[vjai] MCP sidecar ready ..." on stderr, then waits
```

Use a different port on both sides with `VJAI_BRIDGE_PORT` (the app side is hard-wired
to 4820, so change `URL` in `src/agent/bridge.ts` too if you do).

## Tools

| Tool | What it does |
|---|---|
| `get_doc` | The whole show document as JSON. |
| `patch_doc` | `{ ops: [{ op: "set" \| "add" \| "remove", path, value }] }`. Paths are dotted and address arrays by element id: `layers.L1.opacity`, `layers.L1.effects` (add), `outputs.O1.slices.S1.corners`. |
| `snapshot` | JPEG of the current preview, returned as an MCP image. |
| `get_signals` | Live audio numbers: `rms bass mid high kick`, 0..1. |
| `list_media` | Files in the show's media directory (or a given one). |

Edits land in the app instantly and are undoable there (Cmd/Ctrl+Z), because the sidecar
goes through the same store as the UI.

## Notes and limits

- Every window says who it is when it connects (`main` or `output-<id>`). Calls go to
  the newest window that named itself `main`; a hello with no `window` field (an older
  build in a stale tab) is still routable but always loses to a real `main`, and
  projector windows never take tool calls. Windows that are not the active one show
  `bridge: standby`. The sidecar logs the chosen route each time it changes, and drops
  a socket that has not said hello within 5s.
- Tool failures come back with `isError` set (a bad `patch_doc` path, an unknown tool
  name, no app connected), so the client can tell them from a successful call.
- The window must be open. With nothing connected, every tool returns
  `vjai is not connected...` rather than failing the session.
- Calls time out after 15s.
- The bridge lives in the chat panel: closing that panel drops the connection.
- The socket is bound to `127.0.0.1` and has no auth. Anything that can run code on this
  machine can drive the show; that is the same trust level as the app itself.
