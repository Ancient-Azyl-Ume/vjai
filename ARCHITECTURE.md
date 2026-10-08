# vjai architecture

Tauri v2 + React 19 + TypeScript + WebGL2 VJ app. Frontend in `src/`, host in `src-tauri/src/`.
Runs in the Tauri window and, with in-page fallbacks, in a plain browser at http://localhost:1420.

## The document

The whole show is one JSON document (`src/doc/schema.ts`, a zod schema). Layers, effects, outputs,
slices, mods, audio settings: all of it. The host (`src-tauri/src/doc.rs`) holds the authoritative copy;
every window (UI + projector outputs) mirrors it in a zustand store (`src/doc/store.ts`) and re-renders from it.

Nothing mutates the doc. All edits are patch ops sent to the host, which applies them and broadcasts
`doc:changed` to every window:

```ts
type Op = { op: "set" | "add" | "remove"; path: string; value?: unknown };
```

- `path` is dotted. Array segments are either an index or an element `id`: `layers.L1.opacity`,
  `layers.L1.effects.fx2.params.amount`, `outputs.O1.slices.S1.corners`.
- `set` replaces the value at the path (creates object keys). `add` pushes `value` onto the array at
  the path. `remove` deletes the element (array by id/index, object by key).
- `apply_op` in `src-tauri/src/doc.rs` and `applyOp` in `src/rpc.ts` (browser fallback) must stay in sync.

From the UI, only ever go through the store:

```ts
const patch = useDoc((s) => s.patch);  // patch([{ op: "add", path: "layers", value: {...} }])
const set = useDoc((s) => s.set);      // set("layers.L1.opacity", 0.5)
```

`schema.ts` edits are additive only: add fields with defaults, never remove or rename.
`DocSchema.parse` fills defaults, so older docs load.

### Undo / redo

`src/doc/history.ts` keeps snapshots of the doc. Every `patch`/`set`/`replace` pushes the previous
doc; consecutive pure-`set` batches on the same path within 400 ms coalesce (a slider drag is one
step); 200 entries max; a new edit clears redo. `useDoc` exposes `undo()`, `redo()`, `canUndo`,
`canRedo`. Undo/redo apply via `set_doc`, so every window follows. Shortcuts (Cmd/Ctrl+Z,
Cmd/Ctrl+Shift+Z) live in `src/ui/shell/App.tsx` and are ignored while typing in a field.

## Host calls (`src/rpc.ts`)

`call(name, args)` is `invoke` under Tauri and an in-page implementation in the browser (doc in
`localStorage`, shared across tabs with `BroadcastChannel`). `onDocChanged(cb)` subscribes to the
broadcast. `pickFile`/`pickSave`/`fileUrl` wrap the dialog and asset plugins with browser stand-ins.

Commands today: `get_doc`, `set_doc`, `patch_doc`, `list_monitors`, `open_output`, `close_output`,
`save_doc`, `load_doc`, `list_dir`, `get_config`, `set_config`, `log_line`.

## Engine (`src/engine/`)

One `Engine` per window (`src/ui/hooks/useEngine.ts` owns the singleton). It runs a rAF loop:

1. `audio/analyser.ts` produces signals (`rms bass mid high kick`) from the mic.
2. `mods/modulator.ts` resolves the mod matrix into per-frame overrides, keyed by doc path.
   The engine reads every numeric param through `param(path, base)`, which returns the override
   if a mod drives that path, else the doc value. New engine code must read params this way.
3. For every enabled layer, bottom to top: the layer's **source** produces a canvas-sized texture,
   the **effect chain** ping-pongs it through each enabled effect, then the result is blended
   onto the composite FBO with the layer's blend mode and opacity (`core/shaders.ts` FS_BLEND).
4. Each registered **view** (a 2D canvas: preview panel, mapping panel, projector window) gets its
   mode drawn into the hidden GL canvas and blitted. `composite` shows the whole canvas;
   `output` draws that output's slices through the projective warp (`output/slice.ts`,
   `output/warp.ts`, `output/homography.ts`) with edge blend and black level.

`core/gl.ts` has the small GL helpers (compile, FBOs, uniform cache, `ensureFbo`).

### Registries

**Effects** `src/engine/effects/index.ts`: `EFFECT_LIST`, `EFFECTS[type]`, `EffectTypes`,
`EffectDefaults`. An effect is data:

```ts
{ type, label, defaults: { amount: 1 }, ranges: { amount: { min: 0, max: 4 } }, fragment, needsFeedback? }
```

The schema enum, the compiled programs, the layer editor sliders, the mod target list and the chat
agent's prompt all derive from this list.

**Sources** `src/engine/sources/index.ts`: `SOURCES[type]`, plus `createSource`/`sourceKey` for the
engine. A source is `{ type, key?(layer), create(gl, layer) -> { update(ctx) -> WebGLTexture, dispose() } }`.
`update` gets a `SourceCtx` (`layer`, narrowed `source`, `time`, `w`, `h`, `use(name, vs, fs)`
program cache, `target(fbo)`, `drawQuad()`, `param(path, base)`). The engine recreates the
instance when `key(layer)` changes (video path) and disposes it when the layer goes away.

**Panels** `src/ui/panels/registry.ts`: `PANELS: { id, title, component, defaultPlacement: { group, order } }[]`.
The shell (`src/ui/shell/App.tsx`) builds the dockview layout from it: `main` (preview),
`right` (chat), `bottom` (tab strip: layers, mapping, mods, graph).

## UI (`src/ui/`)

- `shell/App.tsx`: top bar, dockview, keyboard shortcuts. `shell/OutputView.tsx`: projector window root.
- `shell/uiStore.ts`: local, never-persisted state (selection, active panel, engine handle).
- `panels/*Panel.tsx`: one file per panel. Panels are view code: they read `useDoc` and write with
  `patch`/`set`. Business rules belong in the store or engine, not here.
- `hooks/useEngine.ts`: `getEngine()` singleton and `useEngineCanvas(mode, fit, box?)` which
  registers a canvas as a view and keeps it sized (fit to `box` or parent, or the window).
- `hooks/useTweakpane.ts`: builds a Tweakpane pane in a ref'd div, rebuilt when deps change.

`src/agent/agent.ts` is the chat agent: it edits the same doc through the same `patch` with a
`patch_doc` tool, and takes UI context (selection, audio signals, a preview snapshot) with each turn.

## How to add things

**Effect**: create `src/engine/effects/<name>.ts` exporting an `EffectDef` (start the fragment with
`FS_HEAD`; every `defaults` key is a `uniform float p_<key>`; set `needsFeedback` to get `u_prev`),
then append it to `EFFECT_LIST` in `effects/index.ts`. No UI code.

**Source**: add the variant to `SourceSchema` in `src/doc/schema.ts`; create
`src/engine/sources/<name>.ts` exporting a `SourceDef<"name">`; append it to `SOURCES`; add a
Tweakpane block for its params in `LayerEditor` (`src/ui/panels/LayersPanel.tsx`) and an "add"
button if it needs one.

**Panel**: create `src/ui/panels/<Name>Panel.tsx` (a plain component, no props); append one entry to
`PANELS` in `src/ui/panels/registry.ts`.

**Host command**: add `#[tauri::command] pub fn` to `src-tauri/src/doc.rs` / `windows.rs` /
`files.rs` (or a new module declared in `lib.rs`); append it to the `generate_handler!` list in
`src-tauri/src/lib.rs`; add a browser fallback under `browser` in `src/rpc.ts` so the app still runs
at http://localhost:1420. Commands that change the doc must emit `doc:changed`.

**Doc field**: add it to the zod schema with a `.default()`/`.prefault()`; read it in the engine
through `param()` if it is numeric and should be modulatable; edit it from panels with `set`.

## Rules

- Never mutate the doc; never call `invoke` directly from UI (use `call` / the store).
- Shared registries (`EFFECT_LIST`, `SOURCES`, `PANELS`, `generate_handler!`, `browser` fallbacks) are append-only.
- Never run `tsc` in build scripts against Tauri; check with `npx tsc --noEmit -p tsconfig.json` and `cargo check`.
