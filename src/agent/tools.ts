import type Anthropic from "@anthropic-ai/sdk";
import { call } from "../rpc";
import { useDoc, type Op } from "../doc/store";
import { useUi } from "../ui/shell/uiStore";

// One tool surface, two callers: the in-app chat agent (agent.ts) and Claude Code
// through the MCP sidecar (bridge.ts -> sidecar/mcp.js). Keep sidecar/mcp.js's
// input schemas in sync with the definitions below.

export type ToolContent = Anthropic.ToolResultBlockParam["content"];

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_doc",
    description: "Return the whole current show document.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "patch_doc",
    description: "Apply patch ops to the show document. Returns the new document or an error.",
    input_schema: {
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
    input_schema: { type: "object", properties: { dir: { type: "string" } } },
  },
  {
    name: "snapshot",
    description: "Grab a JPEG of what the user currently sees in the preview.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_signals",
    description: "Live audio analysis numbers (rms, bass, mid, high, kick), 0..1, plus whether the mic is running.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "set_selection",
    description: "Focus a layer, output or slice in the UI so the user sees what you are talking about.",
    input_schema: {
      type: "object",
      properties: {
        layer: { type: "string" },
        output: { type: "string" },
        slice: { type: "string" },
      },
    },
  },
];

// The engine resolves a snapshot on its next frame, and only when a view is registered.
// With no view (preview panel closed) or a stalled rAF (hidden window) that promise never
// settles, so every caller goes through this race - never through engine.snapshot() direct.
export async function grabSnapshot(): Promise<string | null> {
  const eng = useUi.getState().engine;
  if (!eng) return null;
  return Promise.race([eng.snapshot(), new Promise<null>((r) => setTimeout(() => r(null), 2000))]);
}

// A failed call returns a string starting with "error: "; both callers (the chat panel
// tool card and the sidecar's MCP isError flag) key off that prefix.
export async function runTool(name: string, input: any): Promise<ToolContent> {
  switch (name) {
    case "get_doc":
      return JSON.stringify(useDoc.getState().doc);
    case "patch_doc": {
      try {
        await useDoc.getState().patch(input.ops as Op[]);
        return "ok";
      } catch (e) {
        return "error: " + String(e);
      }
    }
    case "list_media": {
      const dir = input.dir || useDoc.getState().doc.mediaDir;
      if (!dir) return "error: no media directory set; ask the user to pick one in the Layers panel";
      try {
        const entries = await call<{ name: string; path: string; is_dir: boolean }[]>("list_dir", { path: dir });
        return entries.map((e) => (e.is_dir ? "[dir] " : "") + e.path).join("\n") || "(empty)";
      } catch (e) {
        return "error: " + String(e);
      }
    }
    case "snapshot": {
      const dataUrl = await grabSnapshot();
      if (!dataUrl) return "error: no preview available";
      return [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: dataUrl.split(",")[1] } }];
    }
    case "get_signals": {
      const eng = useUi.getState().engine;
      if (!eng) return "error: no engine in this window";
      return JSON.stringify({ running: eng.audio.running, ...eng.audio.signals });
    }
    case "set_selection": {
      const p: { selectedLayer?: string; selectedOutput?: string; selectedSlice?: string } = {};
      if (input.layer) p.selectedLayer = input.layer;
      if (input.output) p.selectedOutput = input.output;
      if (input.slice) p.selectedSlice = input.slice;
      if (Object.keys(p).length === 0) return "error: nothing to select";
      useUi.getState().set(p);
      return "ok";
    }
    default:
      return "error: unknown tool: " + name;
  }
}
