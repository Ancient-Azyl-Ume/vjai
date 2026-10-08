import { create } from "zustand";

// Tiny toast queue. Any panel can call toast("saved") / toast(msg, "error").
export type Toast = {
  id: number;
  kind: "info" | "ok" | "error";
  text: string;
  action?: { label: string; run: () => void };
};

export const useToasts = create<{ items: Toast[] }>(() => ({ items: [] }));

let seq = 0;

// `sticky` keeps a toast up until the user dismisses it. Use it only where missing the
// toast loses work (the crash-recovery offer), never for routine feedback.
type ToastOpts = { label: string; run: () => void; sticky?: boolean };

export function toast(text: string, kind: Toast["kind"] = "info", opts?: ToastOpts): number {
  const id = ++seq;
  const action = opts && { label: opts.label, run: opts.run };
  useToasts.setState((s) => ({ items: [...s.items.slice(-4), { id, kind, text, action }] }));
  if (opts?.sticky) return id;
  const ms = action ? 20000 : kind === "error" ? 8000 : 2500;
  setTimeout(() => dismissToast(id), ms);
  return id;
}

export function dismissToast(id: number) {
  useToasts.setState((s) => ({ items: s.items.filter((t) => t.id !== id) }));
}
