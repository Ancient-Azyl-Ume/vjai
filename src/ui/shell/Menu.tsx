import { useEffect, useRef, useState } from "react";

export type MenuItem =
  | "-"
  | { label: string; hint?: string; run: () => void; checked?: boolean; disabled?: boolean };

// Small top-bar dropdown. Items are data so the same list can feed the native menu.
export function Menu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc, true);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc, true); };
  }, [open]);
  return (
    <div ref={box} className="relative">
      <button className={`px-1.5 py-0.5 rounded ${open ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-white"}`} onClick={() => setOpen((v) => !v)}>
        {label}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-40 min-w-52 rounded border border-neutral-700 bg-neutral-900 py-1 shadow-xl">
          {items.map((it, i) =>
            it === "-" ? (
              <div key={i} className="my-1 h-px bg-neutral-800" />
            ) : (
              <button
                key={i}
                disabled={it.disabled}
                className="w-full flex items-center gap-3 px-2.5 py-1 text-left text-neutral-200 hover:bg-neutral-800 disabled:text-neutral-600 disabled:hover:bg-transparent"
                onClick={() => { setOpen(false); it.run(); }}
              >
                <span className="w-3 shrink-0" style={{ color: "var(--accent)" }}>{it.checked ? "*" : ""}</span>
                <span className="flex-1 truncate">{it.label}</span>
                {it.hint && <span className="text-neutral-500">{it.hint}</span>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
