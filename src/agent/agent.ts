import Anthropic from "@anthropic-ai/sdk";
import { useDoc, type Op } from "../doc/store";
import { buildSystem } from "./prompt";
import { describeOps } from "./diff";
import { runTool, TOOLS } from "./tools";

// The chat agent edits the same document the UI edits, through the same patch ops.
// Context bubble: what the user is looking at right now travels with every message.

export const MODELS = ["claude-opus-5", "claude-sonnet-5", "claude-fable-5-1"] as const;
export const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
export type Model = (typeof MODELS)[number];
export type Effort = (typeof EFFORTS)[number];

export type UiContext = {
  activePanel: string;
  selectedLayer?: string;
  selectedOutput?: string;
  selectedSlice?: string;
  signals?: Record<string, number>;
  // preview JPEG data url, attached to the message when the user turns snapshots on.
  // Must resolve null (not hang) when this window has no rendering preview.
  snapshot?: () => Promise<string | null>;
};

// APIError.message already carries the status and the raw JSON body. Show one plain
// sentence in the panel and keep the raw text behind the collapsible.
function apiError(e: InstanceType<typeof Anthropic.APIError>): { message: string; detail: string } {
  const s = e.status;
  const message =
    s === 401 || s === 403 ? "API key rejected. Put a valid key in the chat panel settings (key)."
    : s === 429 ? "Rate limited. Wait a moment, then send again."
    : s === 400 ? "The API rejected this request."
    : s && s >= 500 ? "Anthropic is having trouble right now. Try again."
    : !s ? "Cannot reach the API. Check the network."
    : `Request failed (${s}).`;
  const body = e.error as { error?: { message?: string } } | undefined;
  const raw = body?.error?.message;
  return { message, detail: raw ? [s, raw].filter(Boolean).join(" ") : e.message };
}

export type ChatEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; id: string; name: string; detail: string[] }
  | { type: "tool_end"; id: string; ok: boolean; message: string }
  | { type: "done" }
  | { type: "error"; message: string; detail?: string };

export class Agent {
  private client?: Anthropic;
  messages: Anthropic.MessageParam[] = [];
  model: Model = "claude-opus-5";
  effort: Effort = "low";

  configure(apiKey: string) {
    this.client = apiKey ? new Anthropic({ apiKey, dangerouslyAllowBrowser: true }) : undefined;
  }

  get ready() {
    return !!this.client;
  }

  reset() {
    this.messages = [];
  }

  async send(text: string, ctx: UiContext, attachSnapshot: boolean, onEvent: (e: ChatEvent) => void) {
    if (!this.client) {
      onEvent({ type: "error", message: "No API key. Set it in the chat panel settings." });
      onEvent({ type: "done" });
      return;
    }
    const context = {
      activePanel: ctx.activePanel,
      selectedLayer: ctx.selectedLayer,
      selectedOutput: ctx.selectedOutput,
      selectedSlice: ctx.selectedSlice,
      signals: ctx.signals,
    };
    const blocks: Anthropic.ContentBlockParam[] = [];
    if (attachSnapshot && ctx.snapshot) {
      try {
        const url = await ctx.snapshot();
        // null means no preview is rendering in this window; carry on without the picture
        if (url) blocks.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: url.split(",")[1] } });
      } catch {
        // same
      }
    }
    blocks.push({ type: "text", text: `<ui_context>${JSON.stringify(context)}</ui_context>\n${text}` });
    this.messages.push({ role: "user", content: blocks });

    // text from a later turn must not run into the previous turn's last word
    let anyText = false;
    try {
      while (true) {
        let turnText = false;
        const stream = this.client.messages.stream({
          model: this.model,
          max_tokens: 16000,
          system: [{ type: "text", text: buildSystem(), cache_control: { type: "ephemeral" } }],
          tools: TOOLS,
          messages: this.messages,
          output_config: { effort: this.effort },
        });
        stream.on("text", (delta) => {
          if (!turnText) {
            turnText = true;
            if (anyText) onEvent({ type: "text", delta: "\n\n" });
          }
          anyText = true;
          onEvent({ type: "text", delta });
        });
        const msg = await stream.finalMessage();
        this.messages.push({ role: "assistant", content: msg.content });
        if (msg.stop_reason === "refusal") {
          const d = msg.stop_details as { category?: string; explanation?: string } | null;
          onEvent({ type: "error", message: `refused${d?.category ? ` (${d.category})` : ""}: ${d?.explanation ?? "the model declined this request"}` });
          break;
        }
        // pause_turn: the turn was cut short mid-work; send it back unchanged to continue
        if (msg.stop_reason === "pause_turn") continue;
        if (msg.stop_reason !== "tool_use") break;

        const uses = msg.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const u of uses) {
          const input = u.input as { ops?: Op[] };
          const detail = u.name === "patch_doc" && input.ops ? describeOps(input.ops, useDoc.getState().doc) : [];
          onEvent({ type: "tool", id: u.id, name: u.name, detail });
          const content = await runTool(u.name, u.input);
          const flat = typeof content === "string" ? content : "";
          onEvent({ type: "tool_end", id: u.id, ok: !flat.startsWith("error"), message: flat.slice(0, 200) });
          results.push({ type: "tool_result", tool_use_id: u.id, content });
        }
        this.messages.push({ role: "user", content: results });
      }
    } catch (e) {
      if (e instanceof Anthropic.APIError) onEvent({ type: "error", ...apiError(e) });
      else onEvent({ type: "error", message: String(e) });
    }
    onEvent({ type: "done" });
  }
}

export const agent = new Agent();
