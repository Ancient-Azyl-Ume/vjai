import { useCallback, useEffect, useState } from "react";
import { call, pickFile } from "../../rpc";
import { useDoc } from "../../doc/store";
import { uid } from "../../doc/schema";
import { MEDIA_EXTS, baseName, cachedThumb, clipSource, getThumb, isImage } from "../../engine/thumbs";
import { btn } from "./classes";

// Media browser: pick a folder, list clips with in-page thumbnails, click to add a layer,
// drag onto a deck slot. In a plain browser list_dir returns nothing, so the panel just
// says so instead of pretending to have media.

export type Entry = { name: string; path: string; is_dir: boolean; size?: number };

// Folder one level up. "/media" goes to "/" (the filesystem root is a real folder to browse),
// "C:\\media" to "C:\\", and a root path has no parent.
export function parentDir(dir: string): string {
  const p = dir.replace(/[\\/]+$/, "");
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  if (i < 0) return "";
  if (i === 0) return "/";
  return /^[A-Za-z]:$/.test(p.slice(0, i)) ? p.slice(0, i + 1) : p.slice(0, i);
}

// Thumbnail for a path, from the memory cache or decoded on demand.
export function useThumb(path: string | null | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(() => (path ? cachedThumb(path) : undefined));
  useEffect(() => {
    if (!path) {
      setUrl(undefined);
      return;
    }
    const hit = cachedThumb(path);
    setUrl(hit);
    if (hit) return;
    let live = true;
    getThumb(path).then((u) => {
      if (live) setUrl(u ?? undefined);
    });
    return () => {
      live = false;
    };
  }, [path]);
  return url;
}

export function MediaPanel() {
  const doc = useDoc((s) => s.doc);
  const patch = useDoc((s) => s.patch);
  const [dir, setDir] = useState(doc.mediaDir);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setDir(doc.mediaDir), [doc.mediaDir]);

  const load = useCallback(async (path: string) => {
    if (!path) {
      setEntries([]);
      setError(null);
      return;
    }
    try {
      setEntries(await call<Entry[]>("list_dir", { path, exts: MEDIA_EXTS }));
      setError(null);
    } catch (e) {
      setEntries([]);
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    void load(dir);
  }, [dir, load]);

  const chooseFolder = async () => {
    const picked = await pickFile({ directory: true });
    if (picked) await patch([{ op: "set", path: "mediaDir", value: picked }]);
  };

  const addLayer = (path: string) => {
    const source = clipSource(path);
    if (!source) return;
    patch([{ op: "add", path: "layers", value: { id: uid("L"), name: baseName(path), enabled: true, source, opacity: 1, blend: "normal", effects: [] } }]);
  };

  const q = query.trim().toLowerCase();
  const shown = entries.filter((e) => !e.name.startsWith(".") && (!q || e.name.toLowerCase().includes(q)));
  const parent = parentDir(dir);

  return (
    <div className="h-full flex flex-col text-xs">
      <div className="flex items-center gap-1 p-1 border-b border-neutral-800">
        <button className={btn} onClick={chooseFolder}>folder</button>
        <button className={btn} onClick={() => parent && setDir(parent)} disabled={!parent} title="up one folder">..</button>
        <button className={btn} onClick={() => void load(dir)} title="rescan">refresh</button>
        <span className="text-neutral-500 truncate flex-1" title={dir}>{dir || "no media folder"}</span>
        <input className="bg-neutral-900 border border-neutral-700 rounded px-1 py-0.5 w-32 outline-none" placeholder="search" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="flex-1 overflow-auto p-1">
        {!dir && <div className="text-neutral-500 p-2">pick a media folder to browse clips.</div>}
        {dir && error && <div className="text-red-400 p-2">{error}</div>}
        {dir && !error && shown.length === 0 && <div className="text-neutral-500 p-2">no media here (video: mp4 mov m4v webm, images: png jpg webp gif).</div>}
        <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}>
          {shown.map((e) => (e.is_dir
            ? <button key={e.path} className="border border-neutral-800 rounded p-2 text-left hover:bg-neutral-800 truncate" onClick={() => setDir(e.path)} title={e.path}>{e.name}/</button>
            : <MediaTile key={e.path} entry={e} onAdd={() => addLayer(e.path)} />))}
        </div>
      </div>
    </div>
  );
}

function MediaTile({ entry, onAdd }: { entry: Entry; onAdd: () => void }) {
  const thumb = useThumb(entry.path);
  const inert = clipSource(entry.path) === null;
  const mb = entry.size ? (entry.size / 1e6).toFixed(1) + " MB" : "";
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", entry.path);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={onAdd}
      title={inert ? `${entry.path} (no image source registered yet)` : `${entry.path}\nclick: add as layer, drag: drop on a deck slot`}
      className={`border border-neutral-800 rounded overflow-hidden cursor-pointer hover:border-neutral-600 ${inert ? "opacity-50" : ""}`}
    >
      <div className="aspect-video bg-neutral-900 flex items-center justify-center text-neutral-600">
        {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" /> : <span>{isImage(entry.path) ? "img" : "vid"}</span>}
      </div>
      <div className="px-1 py-0.5 truncate">{entry.name}</div>
      {mb && <div className="px-1 pb-0.5 text-neutral-600">{mb}</div>}
    </div>
  );
}
