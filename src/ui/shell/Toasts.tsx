import { dismissToast, useToasts } from "./toast";

const tone = {
  info: "border-neutral-700 bg-neutral-900",
  ok: "border-emerald-800 bg-emerald-950",
  error: "border-rose-800 bg-rose-950",
};

export function Toasts() {
  const items = useToasts((s) => s.items);
  if (!items.length) return null;
  return (
    <div className="fixed bottom-3 right-3 z-50 flex flex-col gap-1.5 items-end pointer-events-none">
      {items.map((t) => (
        <div key={t.id} className={`pointer-events-auto max-w-md rounded border px-2.5 py-1.5 text-xs shadow-lg flex items-center gap-2 ${tone[t.kind]}`}>
          <span className="whitespace-pre-wrap break-words">{t.text}</span>
          {t.action && (
            <button className="underline shrink-0" style={{ color: "var(--accent)" }} onClick={() => { t.action!.run(); dismissToast(t.id); }}>
              {t.action.label}
            </button>
          )}
          <button className="text-neutral-500 hover:text-white shrink-0" onClick={() => dismissToast(t.id)}>x</button>
        </div>
      ))}
    </div>
  );
}
