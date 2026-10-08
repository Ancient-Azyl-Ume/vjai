import { useEffect, useRef, useState } from "react";
import { pickFile } from "../../rpc";
import { useDoc } from "../../doc/store";
import { uid, type Deck, type Layer, type Slot } from "../../doc/schema";
import { baseName, cachedThumb, clipExts, clipSource, getThumb } from "../../engine/thumbs";
import { useUi } from "../shell/uiStore";
import { useThumb } from "./MediaPanel";
import { btn, sel } from "./classes";

// Clip deck: rows are layers (topmost first, like the layers panel), columns are 8 slots.
// Clicking a filled slot switches that layer's source to the clip; the slot whose clip the
// layer is playing is highlighted. Deck contents live in the doc, so they save with the show.

const COLS = 8;

const slotAt = (deck: Deck, layerId: string, col: number) => deck.slots.find((s) => s.layerId === layerId && s.col === col);
const isPlaying = (layer: Layer, slot: Slot | undefined) =>
  !!slot?.clipPath && (layer.source as { path?: string }).path === slot.clipPath;

export function DeckPanel() {
  const doc = useDoc((s) => s.doc);
  const patch = useDoc((s) => s.patch);
  const selectedLayer = useUi((s) => s.selectedLayer);
  const setUi = useUi((s) => s.set);
  const [deckId, setDeckId] = useState<string | undefined>(undefined);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const deck = doc.decks.find((d) => d.id === deckId) ?? doc.decks[0];
  const rows = [...doc.layers].reverse();

  // Every doc edit here goes through this so a rejected patch shows up in the panel
  // instead of becoming a silent unhandled rejection.
  const run = (ops: Parameters<typeof patch>[0]) =>
    patch(ops).then(
      () => setError(null),
      (e: unknown) => {
        setError(String(e));
        return Promise.reject(e);
      },
    );

  // Shows saved before decks existed have no `decks` key in the host's doc (the zustand
  // mirror only defaults it to [] after parsing), and `add` needs an existing array.
  // Writing the whole array with `set` creates the key on both hosts.
  const appendTo = (path: string, empty: boolean, value: unknown) =>
    run([empty ? { op: "set", path, value: [value] } : { op: "add", path, value }]);

  const addDeck = () => {
    const id = uid("D");
    setDeckId(id);
    void appendTo("decks", doc.decks.length === 0, { id, name: `deck ${doc.decks.length + 1}`, slots: [] }).catch(() => {});
  };

  const renameDeck = (d: Deck, name: string) => {
    setRenaming(null);
    const clean = name.trim();
    if (!clean || clean === d.name) return;
    void run([{ op: "set", path: `decks.${d.id}.name`, value: clean }]).catch(() => {});
  };

  const removeDeck = (d: Deck) => {
    if (doc.decks.length > 1) setDeckId(doc.decks.find((o) => o.id !== d.id)?.id);
    void run([{ op: "remove", path: `decks.${d.id}` }]).catch(() => {});
  };

  const trigger = (layer: Layer, slot: Slot) => {
    if (!slot.clipPath) return;
    const source = clipSource(slot.clipPath, layer.source);
    if (!source) return;
    void run([{ op: "set", path: `layers.${layer.id}.source`, value: source }]).catch(() => {});
  };

  // The slot is written immediately: a thumbnail decode can take seconds (or time out),
  // and waiting on it would leave the cell looking empty after a drop.
  const assign = (layerId: string, col: number, path: string) => {
    if (!deck || !clipSource(path)) return;
    const existing = slotAt(deck, layerId, col);
    const id = existing?.id ?? uid("sl");
    const thumb = cachedThumb(path);
    const value = { id, layerId, col, clipPath: path, label: baseName(path), thumb };
    const write = existing
      ? run([{ op: "set", path: `decks.${deck.id}.slots.${existing.id}`, value }])
      : appendTo(`decks.${deck.id}.slots`, deck.slots.length === 0, value);
    void write
      .then(async () => {
        if (thumb) return;
        const decoded = await getThumb(path);
        // the slot may be gone by now (cleared, deck deleted): a failed patch is fine here
        if (decoded) await patch([{ op: "set", path: `decks.${deck.id}.slots.${id}.thumb`, value: decoded }]);
      })
      .catch(() => {});
  };

  const clear = (slot: Slot) => {
    if (deck) void run([{ op: "remove", path: `decks.${deck.id}.slots.${slot.id}` }]).catch(() => {});
  };

  const pickInto = async (layerId: string, col: number) => {
    const file = await pickFile({ extensions: clipExts() });
    if (file) assign(layerId, col, file);
  };

  // 1..8 fire the selected layer's row; Shift+1..8 the row above it. Only while the deck
  // panel is on screen (dockview hides inactive tabs, so offsetParent goes null).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!root.current || root.current.offsetParent === null) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const m = /^Digit([1-8])$/.exec(e.code);
      if (!m || !deck) return;
      const here = Math.max(0, rows.findIndex((l) => l.id === selectedLayer));
      const index = e.shiftKey ? here - 1 : here;
      const layer = rows[index];
      if (!layer) return;
      const slot = slotAt(deck, layer.id, Number(m[1]) - 1);
      if (!slot) return;
      e.preventDefault();
      trigger(layer, slot);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="h-full flex flex-col text-xs" ref={root}>
      <div className="flex items-center gap-1 p-1 border-b border-neutral-800">
        {doc.decks.map((d) => (
          renaming === d.id ? (
            <input
              key={d.id}
              autoFocus
              defaultValue={d.name}
              className="bg-neutral-900 border border-sky-700 rounded px-1 py-0.5 w-24 outline-none"
              onBlur={(e) => renameDeck(d, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") renameDeck(d, e.currentTarget.value);
                if (e.key === "Escape") setRenaming(null);
              }}
            />
          ) : (
            <span
              key={d.id}
              className={sel(d.id === deck?.id)}
              onClick={() => setDeckId(d.id)}
              onDoubleClick={() => setRenaming(d.id)}
              title="double-click to rename"
            >
              {d.name}
              <button
                className="ml-1 text-neutral-500 hover:text-red-400"
                title="delete this deck"
                onClick={(e) => {
                  e.stopPropagation();
                  removeDeck(d);
                }}
              >
                x
              </button>
            </span>
          )
        ))}
        <button className={btn} onClick={addDeck}>+ deck</button>
        <span className="flex-1" />
        <span className="text-neutral-500">1-8 fires the selected row, shift+1-8 the row above, right-click clears a slot</span>
      </div>
      {error && <div className="text-red-400 px-2 py-1 border-b border-neutral-800">{error}</div>}
      {!deck && <div className="text-neutral-500 p-2">no deck yet - add one.</div>}
      {deck && rows.length === 0 && <div className="text-neutral-500 p-2">add a layer first: the deck has one row per layer.</div>}
      {deck && rows.length > 0 && (
        <div className="flex-1 overflow-auto p-1">
          <div className="grid gap-1" style={{ gridTemplateColumns: `7rem repeat(${COLS}, minmax(64px, 1fr))` }}>
            <div />
            {Array.from({ length: COLS }, (_, c) => (
              <div key={c} className="text-center text-neutral-600">{c + 1}</div>
            ))}
            {rows.map((layer) => (
              <Row
                key={layer.id}
                layer={layer}
                deck={deck}
                selected={layer.id === selectedLayer}
                onSelect={() => setUi({ selectedLayer: layer.id })}
                onTrigger={trigger}
                onAssign={assign}
                onClear={clear}
                onPick={pickInto}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type RowProps = {
  layer: Layer;
  deck: Deck;
  selected: boolean;
  onSelect: () => void;
  onTrigger: (layer: Layer, slot: Slot) => void;
  onAssign: (layerId: string, col: number, path: string) => void;
  onClear: (slot: Slot) => void;
  onPick: (layerId: string, col: number) => void;
};

function Row({ layer, deck, selected, onSelect, onTrigger, onAssign, onClear, onPick }: RowProps) {
  return (
    <>
      <div className={sel(selected) + " truncate self-center"} onClick={onSelect} title={layer.name}>{layer.name}</div>
      {Array.from({ length: COLS }, (_, col) => {
        const slot = slotAt(deck, layer.id, col);
        return (
          <SlotCell
            key={col}
            slot={slot}
            playing={isPlaying(layer, slot)}
            onClick={() => (slot ? onTrigger(layer, slot) : onPick(layer.id, col))}
            onDrop={(path) => onAssign(layer.id, col, path)}
            onClear={() => slot && onClear(slot)}
          />
        );
      })}
    </>
  );
}

function SlotCell({ slot, playing, onClick, onDrop, onClear }: { slot?: Slot; playing: boolean; onClick: () => void; onDrop: (path: string) => void; onClear: () => void }) {
  const [over, setOver] = useState(false);
  const decoded = useThumb(slot?.thumb ? null : slot?.clipPath);
  const thumb = slot?.thumb ?? decoded;
  return (
    <div
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onClear();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const path = e.dataTransfer.getData("text/plain");
        if (path) onDrop(path);
      }}
      title={slot?.clipPath ?? "empty slot - click to pick a clip, or drop one from the media panel"}
      className={`aspect-video rounded border overflow-hidden relative cursor-pointer ${playing ? "border-sky-400 ring-1 ring-sky-400" : over ? "border-sky-700" : "border-neutral-800 hover:border-neutral-600"} ${slot ? "bg-neutral-900" : "bg-neutral-950"}`}
    >
      {thumb && <img src={thumb} alt="" className="absolute inset-0 w-full h-full object-cover" />}
      {!slot && <div className="absolute inset-0 flex items-center justify-center text-neutral-700">+</div>}
      {slot && <div className="absolute bottom-0 inset-x-0 px-1 truncate bg-black/60">{slot.label || baseName(slot.clipPath ?? "")}</div>}
    </div>
  );
}
