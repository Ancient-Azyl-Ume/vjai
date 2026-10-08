# vjai

A VJ instrument: layered WebGL2 sources and effects, projection mapping with edge blending,
audio-reactive modulation, and a chat agent that edits the running show.

Tauri v2 + React 19 + TypeScript + WebGL2. The whole show is one JSON document; see
[ARCHITECTURE.md](ARCHITECTURE.md) for the document model, the engine pipeline and the registries.

## Requirements

- Node 20+ and pnpm
- Rust (stable) and the Tauri v2 prerequisites (Xcode command line tools on macOS)

## Run

```bash
pnpm install
pnpm tauri dev          # desktop app (opens the Tauri window and vite on :1420)
pnpm dev                # browser only: http://localhost:1420
```

The browser mode is a real fallback, not a stub: the document lives in localStorage, output
"windows" are popups and the file dialogs are prompts (`src/rpc.ts`). Everything else is identical,
which makes the UI fast to poke at without a native rebuild. Two browser-only limits: a popup can
only be closed by the tab that opened it, so `Esc` / "close all outputs" does not reach a projector
opened from another tab or from before a reload (close those by hand), and the popup blocker has to
allow the page or `F` opens nothing.

## Build

```bash
pnpm tauri build        # macOS: .app + .dmg in src-tauri/target/release/bundle
```

Bundle identifier `com.azylume.vjai`, product name `vjai`, targets `app` and `dmg`
(`src-tauri/tauri.conf.json`). The icon set is generated, not committed by hand:

```bash
node scripts/make-icons.mjs   # rewrites src-tauri/icons/* (png, icns, ico)
```

## Using it

The top bar carries the show: file/view/output menus, the show name (click to rename), a dirty
marker, undo/redo, an fps and frame-time readout, audio and output status, and the panic button.
Panels are dockable (dockview) and the layout is remembered per machine; `view > reset layout`
puts it back.

| Key | Action |
| --- | --- |
| Cmd/Ctrl+N / O / S / Shift+S | new / open / save / save as |
| Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z | undo, redo |
| Space | pause/play the selected video layer |
| B | blackout (panic): every projector goes black, the show keeps running |
| F | open all projector outputs |
| Esc | close all outputs |
| 1-8 | deck slots on the selected row (shift: the row above) |
| ? | shortcut list |

### Panels

- **preview** - composite or any single output, fit/1:1, safe frame, live audio meters
- **layers** - source, blend, opacity and the effect chain per layer
- **mapping** - outputs, slices, corner warp, edge blending
- **mods** - the audio/LFO modulation matrix
- **media** / **deck** - clips and live triggering
- **graph** - the show as a node graph
- **chat** - the agent; it edits the same document through the same patch ops
- **settings** - canvas size, audio input device, API key, accent colour, preview render scale

### Files and state

- Shows are plain JSON (`*.vjai.json`), saved wherever you choose.
- Autosave: the document is copied into the user config 2s after the last edit and every 30s.
  On start, if that copy is newer than the last explicit save, a toast offers to restore it.
- Config (api key, recent shows, ui prefs, autosave) lives in `~/.config/vjai/config.json`;
  frontend errors are appended to `~/.config/vjai/frontend.log`.
