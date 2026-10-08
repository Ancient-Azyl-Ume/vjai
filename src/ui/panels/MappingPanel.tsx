import { useEffect, useMemo, useRef, useState } from "react";
import { call } from "../../rpc";
import { useDoc, type Op } from "../../doc/store";
import { OutputSchema, SliceSchema, uid, type Mesh, type Slice } from "../../doc/schema";
import { useUi } from "../shell/uiStore";
import { useEngineCanvas } from "../hooks/useEngine";
import { paneSyncing, useTweakpane } from "../hooks/useTweakpane";
import { btn, sel } from "./classes";
import { mapPoint, squareToQuad } from "../../engine/output/homography";
import { gridUv, meshActive, resampleOffsets, unwarpPoint, warpPoint, zeroOffsets } from "../../engine/output/mesh";

type Monitor = { index: number; name: string; width: number; height: number; scale: number };
// What the user grabbed: a corner-pin handle, a mesh control point, or a mask vertex.
type Pick = { kind: "corner" | "mesh" | "mask"; i: number } | null;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const pct = (p: [number, number]) => `${p[0] * 100},${p[1] * 100}`;

// Outline of a rect in slice space, warped through corners + mesh (for blend zones).
function warpRect(s: Slice, u0: number, v0: number, u1: number, v1: number, n: number): string {
  const out: string[] = [];
  for (let i = 0; i <= n; i++) out.push(pct(warpPoint(s, u0 + (u1 - u0) * (i / n), v0)));
  for (let i = 1; i <= n; i++) out.push(pct(warpPoint(s, u1, v0 + (v1 - v0) * (i / n))));
  for (let i = n - 1; i >= 0; i--) out.push(pct(warpPoint(s, u0 + (u1 - u0) * (i / n), v1)));
  for (let i = n - 1; i >= 1; i--) out.push(pct(warpPoint(s, u0, v0 + (v1 - v0) * (i / n))));
  return out.join(" ");
}

export function MappingPanel() {
  const doc = useDoc((s) => s.doc);
  const patch = useDoc((s) => s.patch);
  const set = useDoc((s) => s.set);
  const ui = useUi();
  const output = doc.outputs.find((o) => o.id === ui.selectedOutput) ?? doc.outputs[0];
  const slice = output?.slices.find((s) => s.id === ui.selectedSlice) ?? output?.slices[0];
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [pick, setPick] = useState<Pick>(null);
  const [maskEdit, setMaskEdit] = useState(false);
  useEffect(() => { call<Monitor[]>("list_monitors").then(setMonitors).catch(console.error); }, []);
  const mon = output ? monitors[output.monitor] : undefined;
  const aspect = mon ? mon.width / mon.height : 16 / 9;
  // The canvas is fitted into `box`; its wrapper shrink-wraps it so the handle overlay covers exactly the canvas.
  const box = useRef<HTMLDivElement>(null);
  const { ref } = useEngineCanvas(output ? { kind: "output", id: output.id } : { kind: "composite" }, { w: 1600, h: 1600 / aspect }, box);
  const overlay = useRef<HTMLDivElement>(null);
  const drag = useRef<Pick>(null);
  const mesh = slice?.mesh;
  const meshOn = !!slice && meshActive(slice.mesh);

  // ----- editing helpers (every write goes through patch/set) -----
  // Pane callbacks and pointer handlers outlive the render they were created in, so read the
  // slice back from the store before every write instead of trusting the captured copy.
  const cur = () => {
    const d = useDoc.getState().doc;
    const o = d.outputs.find((x) => x.id === output?.id) ?? d.outputs[0];
    const s = o?.slices.find((x) => x.id === slice?.id) ?? o?.slices[0];
    return { o, s, base: o && s ? `outputs.${o.id}.slices.${s.id}` : "" };
  };
  // Sub-objects (mesh, mask, blend) are written whole: the store's copy is schema-parsed, so
  // this also repairs slices that reached the host doc without their nested defaults.
  const setSub = (key: "mesh" | "mask" | "blend", value: unknown) => {
    const { s, base: b } = cur();
    if (s) set(`${b}.${key}`, value);
  };
  // Writers reachable from a pane change event: a refresh fires those with the values it just
  // read out of the doc, and writing them back would corrupt the undo history.
  const put = (path: string, value: unknown) => { if (!paneSyncing()) set(path, value); };
  const putSub = (key: "mesh" | "mask" | "blend", value: unknown) => { if (!paneSyncing()) setSub(key, value); };

  // A gesture (one drag, one nudge burst) is one undo step; the flag opens a new one.
  const fresh = useRef(true);
  const write = (ops: Op[]) => {
    patch(ops, !fresh.current);
    fresh.current = false;
  };

  const moveCorner = (i: number, x: number, y: number) => {
    const { s, base: b } = cur();
    if (s) write([{ op: "set", path: `${b}.corners`, value: s.corners.map((c, j) => (j === i ? [x, y] : c)) }]);
  };

  const moveMeshPoint = (i: number, x: number, y: number) => {
    const { s, base: b } = cur();
    if (!s || !meshActive(s.mesh)) return;
    const [u, v] = gridUv(s.mesh, i % s.mesh.cols, Math.floor(i / s.mesh.cols));
    const p = mapPoint(squareToQuad(s.corners as [number, number][]), u, v);
    const offsets = s.mesh.offsets.map((o, j) => (j === i ? [x - p[0], y - p[1]] : o));
    write([{ op: "set", path: `${b}.mesh`, value: { ...s.mesh, offsets } }]);
  };

  const moveMaskPoint = (i: number, x: number, y: number) => {
    const { s, base: b } = cur();
    if (!s) return;
    const uv = unwarpPoint(s, x, y);
    const points = s.mask.points.map((p, j) => (j === i ? [clamp(uv[0], -0.5, 1.5), clamp(uv[1], -0.5, 1.5)] : p));
    write([{ op: "set", path: `${b}.mask`, value: { ...s.mask, points } }]);
  };

  const moveHandle = (p: Pick, x: number, y: number) => {
    if (!p) return;
    if (p.kind === "corner") moveCorner(p.i, x, y);
    else if (p.kind === "mesh") moveMeshPoint(p.i, x, y);
    else moveMaskPoint(p.i, x, y);
  };

  const setMesh = (change: Partial<Mesh>) => {
    const { s } = cur();
    if (!s || paneSyncing()) return;
    const next = { ...s.mesh, ...change };
    if (next.offsets.length !== next.cols * next.rows) next.offsets = resampleOffsets(s.mesh, next.cols, next.rows);
    setSub("mesh", next);
    setPick(null);
  };

  const addMaskPoint = (x: number, y: number) => {
    const { s } = cur();
    if (!s) return;
    const uv = unwarpPoint(s, x, y);
    setSub("mask", { ...s.mask, enabled: true, points: [...s.mask.points, [uv[0], uv[1]]] });
  };

  const removeMaskPoint = (i: number) => {
    const { s } = cur();
    if (!s) return;
    setSub("mask", { ...s.mask, points: s.mask.points.filter((_, j) => j !== i) });
    setPick(null);
  };

  // ----- pointer -----
  const norm = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = overlay.current!.getBoundingClientRect();
    return [clamp((e.clientX - r.left) / r.width, -0.2, 1.2), clamp((e.clientY - r.top) / r.height, -0.2, 1.2)];
  };
  const onDown = (p: NonNullable<Pick>) => (e: React.PointerEvent) => {
    e.stopPropagation();
    if (p.kind === "mask" && (e.altKey || e.metaKey)) { removeMaskPoint(p.i); return; }
    fresh.current = true;
    drag.current = p;
    setPick(p);
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !slice) return;
    const [x, y] = norm(e);
    moveHandle(drag.current, x, y);
  };
  const onUp = () => {
    drag.current = null;
    fresh.current = true;
  };
  const onBackgroundDown = (e: React.PointerEvent) => {
    fresh.current = true;
    if (!maskEdit || !slice) { setPick(null); return; }
    const [x, y] = norm(e);
    addMaskPoint(x, y);
  };

  // ----- keyboard nudge -----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      if (!pick || !slice || !overlay.current) return;
      // the doc can change under a selection (undo, mesh resize), so re-check it exists
      if (pick.kind === "mesh" && (!meshOn || !slice.mesh.offsets[pick.i])) return;
      if (pick.kind === "mask" && !slice.mask.points[pick.i]) return;
      if ((e.key === "Delete" || e.key === "Backspace") && pick.kind === "mask") { removeMaskPoint(pick.i); e.preventDefault(); return; }
      const dx = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
      const dy = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
      if (!dx && !dy) return;
      e.preventDefault();
      const r = overlay.current.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const k = e.shiftKey ? 10 : 1;
      const step: [number, number] = [(dx * k) / r.width, (dy * k) / r.height];
      let cur: [number, number];
      if (pick.kind === "corner") cur = slice.corners[pick.i] as [number, number];
      else if (pick.kind === "mesh") cur = meshHandlePos(slice, pick.i);
      else cur = warpPoint(slice, slice.mask.points[pick.i][0], slice.mask.points[pick.i][1]);
      moveHandle(pick, cur[0] + step[0], cur[1] + step[1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ----- overlay geometry -----
  const outline = useMemo(() => {
    if (!slice) return "";
    const n = meshOn ? 10 : 1;
    const pts: string[] = [];
    const edge = (u0: number, v0: number, u1: number, v1: number) => {
      for (let i = 0; i < n; i++) pts.push(pct(warpPoint(slice, u0 + (u1 - u0) * (i / n), v0 + (v1 - v0) * (i / n))));
    };
    edge(0, 0, 1, 0); edge(1, 0, 1, 1); edge(1, 1, 0, 1); edge(0, 1, 0, 0);
    return pts.join(" ");
  }, [slice, meshOn]);

  const meshPath = useMemo(() => {
    if (!slice || !meshOn || !mesh) return "";
    const seg = 6;
    let d = "";
    const line = (f: (t: number) => [number, number], steps: number) => {
      for (let k = 0; k <= steps; k++) d += (k ? "L" : "M") + pct(f(k / steps));
    };
    for (let j = 0; j < mesh.rows; j++) { const v = j / (mesh.rows - 1); line((t) => warpPoint(slice, t, v), (mesh.cols - 1) * seg); }
    for (let i = 0; i < mesh.cols; i++) { const u = i / (mesh.cols - 1); line((t) => warpPoint(slice, u, t), (mesh.rows - 1) * seg); }
    return d;
  }, [slice, meshOn, mesh]);

  const bands = useMemo(() => {
    if (!slice) return [] as { key: string; pts: string }[];
    const n = meshOn ? 8 : 2;
    const b = slice.blend;
    const out: { key: string; pts: string }[] = [];
    if (b.left.width > 0) out.push({ key: "left", pts: warpRect(slice, 0, 0, b.left.width, 1, n) });
    if (b.right.width > 0) out.push({ key: "right", pts: warpRect(slice, 1 - b.right.width, 0, 1, 1, n) });
    if (b.top.width > 0) out.push({ key: "top", pts: warpRect(slice, 0, 0, 1, b.top.width, n) });
    if (b.bottom.width > 0) out.push({ key: "bottom", pts: warpRect(slice, 0, 1 - b.bottom.width, 1, 1, n) });
    return out;
  }, [slice, meshOn]);

  const maskPts = slice && slice.mask.points.length ? slice.mask.points.map(([x, y]) => warpPoint(slice, x, y)) : [];

  // ----- tweakpane -----
  const sliceRef = useTweakpane((pane) => {
    if (!slice || !output) return;
    const sides = ["left", "right", "top", "bottom"] as const;
    const p = { name: slice.name, enabled: slice.enabled, x: slice.input[0], y: slice.input[1], w: slice.input[2], h: slice.input[3], black: slice.blackLevel };
    pane.addBinding(p, "name").on("change", (e) => put(`${cur().base}.name`, e.value));
    pane.addBinding(p, "enabled").on("change", (e) => put(`${cur().base}.enabled`, e.value));
    const fi = pane.addFolder({ title: "input rect (canvas)" });
    for (const k of ["x", "y", "w", "h"] as const) fi.addBinding(p, k, { min: 0, max: 1 }).on("change", () => put(`${cur().base}.input`, [p.x, p.y, p.w, p.h]));

    const fm = pane.addFolder({ title: "mesh warp" });
    const m = { enabled: slice.mesh.enabled, cols: slice.mesh.cols, rows: slice.mesh.rows };
    fm.addBinding(m, "enabled").on("change", (e) => setMesh({ enabled: e.value }));
    fm.addBinding(m, "cols", { min: 2, max: 16, step: 1 }).on("change", (e) => setMesh({ cols: e.value }));
    fm.addBinding(m, "rows", { min: 2, max: 16, step: 1 }).on("change", (e) => setMesh({ rows: e.value }));
    fm.addButton({ title: "reset mesh" }).on("click", () => {
      const { s } = cur();
      if (s) setSub("mesh", { ...s.mesh, offsets: zeroOffsets(s.mesh.cols, s.mesh.rows) });
    });

    const fk = pane.addFolder({ title: "mask" });
    const k = { enabled: slice.mask.enabled, softness: slice.mask.softness };
    fk.addBinding(k, "enabled").on("change", (e) => putSub("mask", { ...cur().s!.mask, enabled: e.value }));
    fk.addBinding(k, "softness", { min: 0, max: 0.5 }).on("change", (e) => putSub("mask", { ...cur().s!.mask, softness: e.value }));
    fk.addButton({ title: "square mask" }).on("click", () => setSub("mask", { ...cur().s!.mask, enabled: true, points: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]] }));
    fk.addButton({ title: "clear mask" }).on("click", () => setSub("mask", { ...cur().s!.mask, points: [] }));

    const fb = pane.addFolder({ title: "edge blend" });
    const eb: Record<string, { width: number; gamma: number }> = {};
    for (const side of sides) {
      const b = (eb[side] = { width: slice.blend[side].width, gamma: slice.blend[side].gamma });
      const putSide = (v: Partial<{ width: number; gamma: number }>) => {
        const { s } = cur();
        if (s) putSub("blend", { ...s.blend, [side]: { ...s.blend[side], ...v } });
      };
      fb.addBinding(b, "width", { label: side + " w", min: 0, max: 0.5 }).on("change", (e) => putSide({ width: e.value }));
      fb.addBinding(b, "gamma", { label: side + " g", min: 0.5, max: 4 }).on("change", (e) => putSide({ gamma: e.value }));
    }
    const og = { gamma: output.blendGamma };
    fb.addBinding(og, "gamma", { label: "output gamma", min: 0.2, max: 4 }).on("change", (e) => put(`outputs.${output.id}.blendGamma`, e.value));

    pane.addBinding(p, "black", { min: 0, max: 0.2 }).on("change", (e) => put(`${cur().base}.blackLevel`, e.value));
    pane.addButton({ title: "reset corners" }).on("click", () => set(`${cur().base}.corners`, [[0, 0], [1, 0], [1, 1], [0, 1]]));
    pane.addButton({ title: "delete slice" }).on("click", () => patch([{ op: "remove", path: cur().base }]));

    // Bindings hold copies of the doc values, so mirror the doc back into them whenever it
    // changes elsewhere (toolbar buttons, canvas drags, undo, the agent, another window).
    // The hook calls this and then refreshes the pane, behind its syncing flag.
    return () => {
      const { o, s } = cur();
      if (!o || !s) return;
      p.name = s.name; p.enabled = s.enabled; p.black = s.blackLevel;
      p.x = s.input[0]; p.y = s.input[1]; p.w = s.input[2]; p.h = s.input[3];
      m.enabled = s.mesh.enabled; m.cols = s.mesh.cols; m.rows = s.mesh.rows;
      k.enabled = s.mask.enabled; k.softness = s.mask.softness;
      for (const side of sides) { eb[side].width = s.blend[side].width; eb[side].gamma = s.blend[side].gamma; }
      og.gamma = o.blendGamma;
    };
  }, [slice?.id, output?.id]);

  // Push schema-complete objects: the host doc is plain JSON, it does not fill in defaults.
  const addSlice = () => output && patch([{ op: "add", path: `outputs.${output.id}.slices`, value: SliceSchema.parse({ id: uid("S"), name: "slice", corners: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]] }) }]);
  const addOutput = () => patch([{ op: "add", path: "outputs", value: OutputSchema.parse({ id: uid("O"), name: "projector", monitor: 1, slices: [] }) }]);

  return (
    <div className="h-full flex text-xs">
      <div className="w-64 border-r border-neutral-800 flex flex-col overflow-auto">
        <div className="flex flex-wrap gap-1 p-1 border-b border-neutral-800">
          <button className={btn} onClick={addOutput}>+ output</button>
          <button className={btn} onClick={addSlice} disabled={!output}>+ slice</button>
          <button className={btn} onClick={() => call("identify_monitors").catch((e) => alert(String(e)))}>identify</button>
          <button className={btn} onClick={() => call("close_all_outputs").catch((e) => alert(String(e)))}>close all</button>
        </div>
        {doc.outputs.map((o) => {
          const om = monitors[o.monitor];
          return (
            <div key={o.id} className="p-1 border-b border-neutral-900">
              <div className={sel(o.id === output?.id) + " flex items-center gap-1"} onClick={() => ui.set({ selectedOutput: o.id, selectedSlice: o.slices[0]?.id })}>
                <span className="flex-1 truncate">{o.name}</span>
                <button className={btn} onClick={(e) => { e.stopPropagation(); call("open_output", { outputId: o.id, monitor: o.monitor }).catch((err) => alert(String(err))); }}>go</button>
                <button className={btn} onClick={(e) => { e.stopPropagation(); call("close_output", { outputId: o.id }); }}>x</button>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <select className="bg-neutral-900 text-[10px] flex-1 min-w-0" value={o.monitor} onChange={(e) => set(`outputs.${o.id}.monitor`, Number(e.target.value))}>
                  {monitors.map((m) => <option key={m.index} value={m.index}>{m.index}: {m.name}</option>)}
                  {!om && <option value={o.monitor}>{o.monitor}: (missing)</option>}
                </select>
                <span className="text-[10px] text-neutral-500 whitespace-nowrap">{om ? `${om.width}x${om.height}` : "-"}</span>
              </div>
              <OutputThumb id={o.id} aspect={om ? om.width / om.height : 16 / 9} />
              <div className="flex gap-1 mt-0.5">
                <button className={sel(o.testPattern)} onClick={() => set(`outputs.${o.id}.testPattern`, !o.testPattern)}>test</button>
                <button className={sel(o.blackout)} onClick={() => set(`outputs.${o.id}.blackout`, !o.blackout)}>black</button>
                <span className="ml-auto text-[10px] text-neutral-500 self-center">g {o.blendGamma.toFixed(2)}</span>
              </div>
              <div className="pl-2 flex flex-col gap-0.5 mt-1">
                {o.slices.map((s) => (
                  <div key={s.id} className={sel(s.id === slice?.id && o.id === output?.id)} onClick={() => ui.set({ selectedOutput: o.id, selectedSlice: s.id })}>
                    {s.name}{meshActive(s.mesh) ? " ·mesh" : ""}{s.mask.enabled && s.mask.points.length >= 3 ? " ·mask" : ""}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <div className="mt-2 border-t border-neutral-800" ref={sliceRef} />
      </div>

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <div className="flex items-center gap-1 p-1 border-b border-neutral-800">
          <button className={sel(maskEdit)} onClick={() => setMaskEdit(!maskEdit)} disabled={!slice}>edit mask</button>
          <span className="text-[10px] text-neutral-500">
            {maskEdit ? "click to add a point, alt-click a point to delete" : "drag handles, arrows nudge (shift = 10px)"}
          </span>
          {pick && <span className="ml-auto text-[10px] text-sky-400">{pick.kind} {pick.i}</span>}
        </div>
        <div ref={box} className="flex-1 flex items-center justify-center bg-black min-h-0 p-1">
          <div className="relative">
            <canvas ref={ref} className="block" />
            <div ref={overlay} className="absolute inset-0" onPointerMove={onMove} onPointerUp={onUp} onPointerDown={onBackgroundDown}>
              {slice && (
                <>
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {bands.map((b) => (
                      <polygon key={b.key} points={b.pts} fill="rgba(56,189,248,0.10)" stroke="#0ea5e9" strokeWidth="0.5" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
                    ))}
                    {meshPath && <path d={meshPath} fill="none" stroke="#f59e0b" strokeWidth="0.3" strokeOpacity="0.6" vectorEffect="non-scaling-stroke" />}
                    <polygon points={outline} fill="none" stroke="#38bdf8" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
                    {maskPts.length >= 2 && (
                      <polygon points={maskPts.map(pct).join(" ")} fill="rgba(16,185,129,0.10)" stroke="#10b981" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
                    )}
                  </svg>
                  <Handles slice={slice} meshOn={meshOn} maskPts={maskPts} pick={pick} onDown={onDown} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Where mesh control point i currently sits in output space.
function meshHandlePos(s: Slice, i: number): [number, number] {
  const b = mapPoint(squareToQuad(s.corners as [number, number][]), ...gridUv(s.mesh, i % s.mesh.cols, Math.floor(i / s.mesh.cols)));
  const o = s.mesh.offsets[i];
  return [b[0] + o[0], b[1] + o[1]];
}

function Handles({ slice, meshOn, maskPts, pick, onDown }: {
  slice: Slice;
  meshOn: boolean;
  maskPts: [number, number][];
  pick: Pick;
  onDown: (p: NonNullable<Pick>) => (e: React.PointerEvent) => void;
}) {
  const on = (kind: string, i: number) => pick?.kind === kind && pick.i === i;
  const dot = (x: number, y: number, cls: string) => ({ className: cls, style: { left: `${x * 100}%`, top: `${y * 100}%` } });
  const meshDots: { i: number; p: [number, number] }[] = [];
  if (meshOn) {
    const { cols, rows } = slice.mesh;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        // the four grid corners are the corner-pin handles, do not double them up
        if ((i === 0 || i === cols - 1) && (j === 0 || j === rows - 1)) continue;
        const k = j * cols + i;
        meshDots.push({ i: k, p: meshHandlePos(slice, k) });
      }
    }
  }
  return (
    <>
      {meshDots.map((d) => (
        <div key={"m" + d.i} onPointerDown={onDown({ kind: "mesh", i: d.i })}
          {...dot(d.p[0], d.p[1], `absolute w-2 h-2 -ml-1 -mt-1 rounded-full border border-black cursor-move ${on("mesh", d.i) ? "bg-white ring-2 ring-amber-400" : "bg-amber-400"}`)} />
      ))}
      {maskPts.map((p, i) => (
        <div key={"k" + i} onPointerDown={onDown({ kind: "mask", i })}
          {...dot(p[0], p[1], `absolute w-2.5 h-2.5 -ml-[5px] -mt-[5px] rotate-45 border border-black cursor-move ${on("mask", i) ? "bg-white ring-2 ring-emerald-400" : "bg-emerald-400"}`)} />
      ))}
      {slice.corners.map(([x, y], i) => (
        <div key={"c" + i} onPointerDown={onDown({ kind: "corner", i })}
          {...dot(x, y, `absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border border-black cursor-move ${on("corner", i) ? "bg-white ring-2 ring-sky-400" : "bg-sky-400"}`)} />
      ))}
    </>
  );
}

// Live picture of one output in the sidebar; just another engine view.
function OutputThumb({ id, aspect }: { id: string; aspect: number }) {
  const box = useRef<HTMLDivElement>(null);
  const { ref } = useEngineCanvas({ kind: "output", id }, { w: 480, h: 480 / aspect }, box);
  return (
    <div ref={box} className="h-14 mt-1 bg-black flex items-center justify-center border border-neutral-800">
      <canvas ref={ref} className="block" />
    </div>
  );
}
