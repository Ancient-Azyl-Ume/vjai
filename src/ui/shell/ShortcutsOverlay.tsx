import { useSession } from "./session";

const KEYS: [string, string][] = [
  ["Cmd/Ctrl + N", "new show"],
  ["Cmd/Ctrl + O", "open show"],
  ["Cmd/Ctrl + S", "save show"],
  ["Cmd/Ctrl + Shift + S", "save as"],
  ["Cmd/Ctrl + Z", "undo"],
  ["Cmd/Ctrl + Shift + Z", "redo"],
  ["Space", "pause / play the selected video layer"],
  ["B", "blackout (panic) on/off"],
  ["F", "open all projector outputs"],
  ["Esc", "close all outputs (or this overlay)"],
  ["1 - 8", "deck slots on the selected layer's row"],
  ["Shift + 1 - 8", "deck slots on the row above"],
  ["?", "this list"],
];

export function ShortcutsOverlay() {
  const open = useSession((s) => s.shortcutsOpen);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => useSession.setState({ shortcutsOpen: false })}>
      <div className="rounded border border-neutral-700 bg-neutral-900 p-4 text-xs shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-3">
          <span className="text-sm font-semibold">keyboard</span>
          <span className="text-neutral-500">click anywhere or press Esc to close</span>
        </div>
        <table>
          <tbody>
            {KEYS.map(([k, v]) => (
              <tr key={k}>
                <td className="pr-6 py-0.5 font-mono whitespace-nowrap" style={{ color: "var(--accent)" }}>{k}</td>
                <td className="py-0.5 text-neutral-300">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
