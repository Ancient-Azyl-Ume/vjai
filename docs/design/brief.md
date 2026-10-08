# vjai design brief

Status: v2, derived from `docs/research/ui-references.md` and revised against the v1 critique. Pattern IDs in parentheses (VJ-1, DAW-4, PRO-6, AI-3, REM-5, GL-7) point at that file. Sources checked for v2 are listed inline as URLs; anything marked "not verified" is a requirement we could not confirm from a primary source.

The product: an AI-native VJ app for a permanent installation in a bar. A headless Mac Mini drives 3 to 5 projectors. The operator controls it from a phone (dashboard) and a laptop browser (stage workbench). Dark room, 3am, tired eyes. Everything below is measured against one question: can it be read at a glance and operated without a mis-click at 3am.

---

## 1. Principles

1. **The picture is the interface.** The PROGRAM monitor is the only high-luminance area; every panel sits in tonal tiers below it so the output dominates the eye. PROGRAM is drawn at the composition's real aspect, never forced into 16:9. (VJ-1, PRO-2, GL-4, anti-pattern "monitors crammed into a corner")
2. **Look before you fire.** Selecting anything only changes PREVIEW; going live is a separate, larger GO or a hold gesture, and every program step has a transition. This includes `Rand`: a random look lands in PREVIEW and needs GO. (VJ-1, VJ-6, REM-5, Synesthesia no-crossfade anti-pattern)
3. **Three colours carry status, nothing else does, and hue is never the only carrier.** Yellow = on air, red = not at full output or danger, violet = the agent. The three status colours are hue neighbours (44, 31, 4), so each one also has a fixed form: live = filled with a dot, warn = outline plus hatched fill, critical = filled with a 3 px frame. Every other colour is a signal-family label inside the drawer, and every colour is paired with a word or a glyph. (VJ-2, VJ-4, GL-5, GL-11)
4. **One drawer, one panel, driven by selection, pinnable.** The right drawer shows exactly one panel; the selected thing fills it; a pin holds it; never more than one selection. (PRO-6, PRO-7, PRO-9, VJ-bonus)
5. **Truth comes from the engine.** Button state, master level and program state are drawn only from engine feedback; staleness is shown as a number; degraded modes are announced in the header, never discovered by a dead button. The phone never shows a problem it cannot act on: every red word has an action next to it. (REM-9, REM-12, REM anti-patterns 4 and 5)
6. **Every agent change is a card with Undo, and Undo is undoable.** One line of what changed, a +n -n badge, Keep / Undo, a checkpoint per turn; destructive classes always get an Allow card. Undo operates on the show file only, never on transport (see 3.9). (AI-3, AI-4, AI-5, AI anti-patterns 1 and 3)
7. **Guard by gesture, never by modal.** Phone blackout and restart on both devices are hold-to-arm with visible progress; laptop blackout is one click or Escape because it must be as fast as a panic key; nothing ever opens a dialog over the output; every label is a visible word in Title Case (rail tabs included), every number is tabular. (REM-5, REM-6, PRO-3, PRO-10, GL-7)
8. **Keys have one owner and the owner is printed.** Performance keys act only when no text field has focus; Escape is the exception and always reaches panic; the status line always shows who owns the keyboard (`Keys: Stage` / `Keys: Typing`). (new, from the v1 critique)

---

## 2. Tokens

### 2.1 Palette

Contrast ratios computed with the WCAG 2.x formula against the four surfaces. Targets: 7:1 for anything read at a glance (program name, BPM, master value, state badges), 4.5:1 for all other text, 3:1 for control boundaries, tracks and focus rings (GL-1, GL-2).

**Ground and surfaces** (tonal elevation, no shadows; computed relative luminance 0.65 / 1.15 / 1.83 / 2.93%, GL-4)

| Token | Hex | Luminance | Use |
|---|---|---|---|
| `ground` | `#121316` | 0.65% | page background, monitor letterbox |
| `surface-1` | `#1A1C20` | 1.15% | panels: top bar, program strip, timeline, drawer body |
| `surface-2` | `#22252A` | 1.83% | cards and rows: program cells, layer rows, agent cards, macro slots |
| `surface-3` | `#2C3037` | 2.93% | popovers, drawer header, selected row fill, phone bottom sheet |

Adjacent tiers contrast 1.09 / 1.11 / 1.16:1 (computed) on purpose; tiers separate areas, borders separate controls.

**Text** (never pure white; halation, GL-3)

| Token | Hex | On ground | On surface-3 | Use |
|---|---|---|---|---|
| `text-high` | `#E4E5E7` | 14.7:1 | 10.5:1 | values, names, state words, anything read at a glance |
| `text-mid` | `#A3A6AB` | 7.6:1 | 5.4:1 | labels, secondary text, unit suffixes |
| `text-low` | `#6B6F76` | 3.7:1 | 2.6:1 | disabled and placeholder only; never carries information |

**Borders and tracks**

| Token | Hex | Notes |
|---|---|---|
| `border-strong` | `#737780` | control boundaries, slider tracks, focus ring base: 4.1:1 on ground, 3.8:1 on surface-1, 3.4:1 on surface-2. On surface-3 it drops to 2.95:1, so controls that sit on surface-3 use `text-mid` for their boundary. |
| `border-subtle` | `#2F333A` | decorative dividers only (1.2 to 1.5:1, allowed because they carry no meaning) |

**Accents** (hand-picked, desaturated for a dark ground; the numbers in the table are the rule, not a named tone scale. All pass 4.5:1 as text on every tier except where noted; dark text `#121316` on any accent fill passes 6:1 or better, GL-5)

| Token | Hex | On ground | Form | Role |
|---|---|---|---|---|
| `live` | `#F2C64B` | 11.5:1 | filled, with a dot | the ONE "on air / armed" accent: on-air fill with dot, armed outline, GO button, LIVE badge, playhead |
| `agent` | `#B7A4F5` | 8.5:1 | left rule | the ONE "AI / agent" accent: agent status word, agent cards' left rule, agent-authored keyframes |
| `good` | `#62C489` | 8.7:1 | word only | engine healthy, supervisor ok, frames ok, checkpoint restored |
| `warn` | `#E9973E` | 7.9:1 | outline plus hatched fill | FROZEN, stale engine, awaiting input, a stored value that differs from the live value (MadMapper orange, VJ-11) |
| `critical` | `#F3746B` | 6.7:1 (4.75:1 on surface-3) | filled, with a 3 px frame | BLACK state, master under 100%, offline, failed, hard-cut border flash, delete |

Live vs warn contrast is 1.45:1 and warn vs critical 1.19:1 (computed), so two status colours are never set as plain text of the same size next to each other; the form column above is mandatory wherever two of them can meet (program cells, the top bar badge slot, the phone header). Moving `warn` to a darker amber was computed and rejected: at hue 25 to 28 it lands 1.04 to 1.10:1 from `critical`, worse than today. Form carries the difference, not hue.

**Signal-flow hues** (modulation sources, node families, wires; only inside the drawer and the graph, GL-9, GL-10)

| Token | Hex | On ground | Family |
|---|---|---|---|
| `sig-audio` | `#4FC8DF` | 9.4:1 | audio analysis: bands, beat, RMS |
| `sig-lfo` | `#EE7FBF` | 7.5:1 | LFO, envelope, clock-driven |
| `sig-macro` | `#6FA6F3` | 7.5:1 | macro slots 1 to 8, MIDI/OSC-driven |
| `sig-agent` | `#B7A4F5` | 8.5:1 | same value as `agent`: parameters the agent is driving or has locked |
| video nodes | `text-high` on `surface-2` | neutral | video is the default family and gets no hue; generators one tier darker than filters |

**Opacity rules.** Two dim levels, and opacity is never the only carrier:
- **60% = still identifiable and operable.** Bypassed layers (the `B` toggle stays lit), done timeline blocks (word `done`), out-of-scope program cells, non-eligible drop targets, unmodulated ring tracks. `text-high` at 60% over `surface-2` is 5.3:1 (computed), still above 4.5:1.
- **40% = truly disabled.** Controls the engine will not accept right now, with a word over them (`Stale`, `Locked`). `text-high` at 40% over `surface-2` is 3.19:1 and `text-mid` 2.19:1 (computed), which is why 40% is reserved for the WCAG "inactive" case only (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- Learn mode: mappable controls get a 2 px `text-high` outline plus a protocol letter badge (`K` keyboard, `M` MIDI, `O` OSC, `A` agent); everything else dims to 60%. Signal hues are never reused for protocols. Preview stream on the phone renders at 80% brightness (GL-recommendation).

**Selection.** Selection spends no hue: `surface-3` fill plus a 1 px `text-high` outline, 10.5:1. This keeps yellow, red and violet unambiguous across the room. (Resolume's blue selection, VJ-3, is replaced by a neutral so that principle 3 holds.)

### 2.2 Typography

Inter and JetBrains Mono, both OFL, **self-hosted as woff2 from the Mac Mini** with `font-display: swap` and a size-adjusted fallback stack (`system-ui` / `ui-monospace` with `size-adjust` tuned so the 20 and 28 px readouts do not reflow). The app is served on the club's network; a CDN fetch that fails would drop `tnum` and the dotted zero on the numbers we read most.

| Role | Face | Size / line | Weight | Notes |
|---|---|---|---|---|
| UI body | Inter | 13 / 18 px | 400 | property names, chat text, list rows |
| UI label | Inter | 12 / 16 px | 500 | control labels, drawer headings in Title Case |
| UI small | Inter | 11 / 14 px | 500 | timeline tick labels only; the floor, nothing smaller |
| UI emphasis | Inter | 13 / 18 px | 600 | program names, state words in the top bar, rail tab words |
| Readout | JetBrains Mono | 13 / 16 px | 400 | value inside a control; never smaller than the label beside it |
| Readout cell | JetBrains Mono | 14 / 18 px | 500 | timecode and duration in a program cell |
| Readout large | JetBrains Mono | 20 / 24 px | 500 | BPM, master value, clock in the top bar |
| Readout hero (phone) | JetBrains Mono | 28 / 32 px | 500 | one number only: engine age, or master when under 100 |
| Phone body / label | Inter | 15 / 20 px and 13 / 16 px | 400 / 500 | |
| Phone button | Inter | 17 / 22 px | 600 | hero and quick tile labels |

- `font-feature-settings: "tnum", "zero"` on every element that can show a digit, in both faces. Inter documents `tnum` and slashed `zero`; JetBrains Mono ships a dotted zero by default. (GL-7)
- Weights 400 / 500 / 600 only; no 300, no 700 (halation).
- Labels in Title Case, no abbreviations, no "Enable" prefixes; tooltips 2 to 3 lines starting with a verb. (PRO-10)
- Laptop base is one step larger than a daylight tool (13 px body, not 11 or 12). (PRO-12)

### 2.3 Spacing, rows, hit sizes

- Scale (px): 2, 4, 8, 12, 16, 24, 32, 48, 64. Panel padding 12, card padding 8, gap between controls 4 vertical, 8 horizontal.
- Laptop row heights: property row 24 (Blender's 20 px unit plus 4), list row 32, layer row 32 compact (default) or 56 with thumbnail (option; the selected row always shows its thumbnail), program cell 64 tall x 120 wide, timeline block lane 32, keyframe lane 20, top bar 40, status line 24, drawer rail 64 wide, drawer 360 default (min 320, max 480; wide mode up to 60% of the viewport).
- Laptop pointer targets: 24 px minimum (WCAG 2.5.8) for authoring rows (property rows, matrix rows, graph ports). **32 px minimum, stated explicitly, for everything touched during a set:** GO, Blackout, Freeze, Master, X / B / S on layer rows, macro slots, program cells, `Back to program`, `Back to timeline`, rail tabs.
- Phone (pt): hero button 96 tall, quick tile 72, restart row 56, macro slider 56 tall with the value inside the thumb, bottom tab 56 plus `env(safe-area-inset-bottom)`, header 120 including `env(safe-area-inset-top)`, minimum any target 48, gap 8, gap around Blackout 12. Viewport meta carries `viewport-fit=cover` so the tab bar is never under the home indicator (https://developer.mozilla.org/en-US/docs/Web/CSS/env). (GL-6)

---

## 3. Laptop "Stage" layout

Viewport target 1440 x 900 and up. One layout, no pages: heavy tools widen the drawer instead of replacing the stage (PRO-1, PRO-2 adapted).

**Runs as an installed web app or kiosk window, not a browser tab.** Chrome and Safari both own Escape, Cmd+L and Cmd+1..8 in a tab (Chrome: "Jump to the address bar", "Jump to a specific tab", Escape "Stop the page loading", https://support.google.com/chrome/answer/157179; Safari: Cmd+L "Select the Smart Search field", Esc "Exit full-screen view", https://support.apple.com/guide/safari/keyboard-shortcuts-and-gestures-cpsh003/mac). The workbench is installed as a standalone PWA (or opened in a kiosk window on the Mac Mini's display when one is attached) so there is no address bar or tab strip to catch keys. Full-screen PROGRAM is an in-page layout mode, never the browser Fullscreen API, because the browser exits that on Escape and the page cannot stop it (https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API/Guide: "Pressing Esc or F11 exits all fullscreen elements"); Keyboard Lock would not help, it only exists inside JS fullscreen and Chrome's own escape hatch is a two-second Esc hold (https://developer.chrome.com/docs/capabilities/web-apis/keyboard-lock).

```
+--------------------------------------------------------------------------------------------------------+
| [Blackout] [Master ▮▮▮▮▮▮▮▮▮▮ 100] [Freeze] | Friday Techno  ● LIVE | 128.0 BPM · Link 2 | Engine 0.3 s | Agent: editing | [Follow ✓] [Learn] [Lock] |
+-----------------------------------------------------------------------------+-----+--------------------+
|                                                          |                  |     | Layers    [Pin] [/]|
|                                                          |    PREVIEW       | 1   +--------------------+
|                                                          |  selected or     | Lay | 1 Base      X B S  |
|                   PROGRAM                                |  next step       | ers | 2 Kaleido   X B S  |
|          what the projectors show right now              |  (min 320 px)    |     | 3 Feedback  X B S  |
|                (composition, real aspect)                +------------------+ 2   | ...scrolls...      |
|                                                          |  GO ▶  fade 2.0 s| Mod +======= drag =======+
+----------------------------------------------------------+------------------+ ula | Effects · Layer 3  |
| PROGRAM  [Back]|[1 Warm ][2 Build][3 Peak ● 02:14][4 Breathe NEXT][5 Fade] ▸ | tion| Feedback           |
| MACROS   1 Intensity ▮▮▮▮▯ 0.62  2 Speed ▮▮▯▯▯ 0.30  3 Hue ▮▮▮▯▯ 0.55 ...   |     |  Amount ▮▮▮▮▯ 0.70 |
+-----------------------------------------------------------------------------+ 3   |   ⟨A⟩▂▃▅▇▅▃  ◉A   |
| EVENING  22:00       23:00       00:00   ▼ 00:42    01:00       02:00       | Map |  Decay  ▮▮▯▯▯ 0.20 |
|          [Warmup done][Build done ][Peak ●      ][Cooldown    ][Close]      | ... |                    |
+-----------------------------------------------------------------------------+-----+--------------------+
| Agent: editing · +2 -1 [Undo] [Stop] · Undo: layer 3 feedback · Keys: Stage        60 fps · outputs 4/4 ok |
+--------------------------------------------------------------------------------------------------------+
```

### 3.1 Regions

**Top bar (40 px, `surface-1`, always visible).** Left to right, in the same order as the phone header (REM-1):
1. Master cluster: `Blackout` (label flips per phase, see 3.6), `Master` fader with value, `Freeze` (flips to `Unfreeze`). All three are stage controls: `tabindex=-1`, they blur themselves on click so a following Space never re-activates them.
2. Program name in `text-high` 600, max 200 px with ellipsis and tooltip, and the state badge slot. **Badge precedence: Offline > Black > Frozen > Stale > Master low > Live.** The slot shows the highest; every lower state that is also true stays visible as its own coloured word further along the bar (`FROZEN` next to the Freeze button, `62` on the master, `Stale` on the engine readout), never dropped.
3. BPM and source (`128.0 BPM · Live` or `· Tap`), Readout large, tabular, then **`Link n`**: Ableton Link peer count, reserved for tempo peers only (REM-11).
4. **`Engine 0.3 s`**: the word `Engine` plus the last-frame age from the heartbeat; `good` under 1 s, `warn` 1 to 3 s with the word `Stale`, `critical` beyond with `Offline`. Next to it `Supervisor ok` / `Supervisor offline` from the supervisor's own heartbeat (see 3.6). (REM-12)
5. Agent status word (`idle`, `thinking`, `editing`, `needs you`, `failed`) in `agent`; `needs you` uses `warn`. The state only; the target (`layer 3 feedback`) goes to the status line. (AI-8)
6. Global toggles: `Follow` (follow actions on/off, DAW-8), `Learn` (mapping mode, VJ-9), `Lock` (UI lock, VJ-12).

**Monitor band (fills remaining height above the strips).** PROGRAM is the composition canvas at its real aspect, height-capped; PREVIEW is the same canvas showing the selection or the next step. Side by side (PREVIEW at one third of PROGRAM's width, GO under PREVIEW) while the composition aspect is 2.4:1 or narrower; when it is wider (three to five 1920 x 1080 outputs edge to edge are 5:1 to 9:1) the band stacks PREVIEW under PROGRAM, both full width, GO at PREVIEW's right end, and the evening timeline collapses to 32 px to give the rows back. **PREVIEW has a size floor of 320 px wide**; if the layout cannot honour it at 900 px height the timeline collapses first, then the drawer narrows to 320. `V` swaps the PROGRAM and PREVIEW sizes for judging the next look; the overlay word tells you which is which. A third variant, **Outputs**, shows per-output tiles (2 x 3 max) and is reached from the Outputs panel or by clicking the overlay word. Both monitors are the only areas allowed to be bright. Overlays are words in the top-left corner of the monitor, never icons: `BLACK` (3 px `critical` frame plus label), `FADING` during the panic fade, `FROZEN` (`warn` label), `STALE 3 s` (grey wash plus label), `OUTPUT 2` when a mapping is being edited. Shift+F makes PROGRAM full-screen as an in-page mode; only Shift+F or Escape-as-panic leave it, and Space, arrows, F and the drawer keys keep working inside it (PRO-2). (VJ-1, VJ-12)

**Program strip (`surface-1`, two rows).** Row 1: `Back to program` pinned in a fixed 96 px cell outside the scroller, then the program cells in a horizontally scrolling strip that auto-keeps the on-air and `NEXT` cells in view (Millumin scrolls to the launched column, https://help.millumin.com/v4/playback/dashboard/). Row 2: the eight macro slots in fixed order 1 to 8 (see 3.5).

**Evening timeline (`surface-1`, 96 px, collapsible to 32; collapses automatically at 900 px height or a wide composition).** See 3.5.

**Status line (24 px, `surface-1`).** Left: the agent's latest activity with its target and badge, `Undo` for the last turn, `Stop` while it runs; then the undo stack top as a word (`Undo: layer 3 feedback`); then the keyboard owner (`Keys: Stage` / `Keys: Typing`); then `Timeline overridden · Back` when it applies. Right: fps, outputs ok count, engine uptime. Must change within 1 s of any request. (AI-7, AI-8)

**Drawer (right, `surface-1`, 360 px).** A vertical rail of six tabs, 64 px wide, each with an icon, the full word (`Layers`, `Modulation`, `Mapping`, `Graph`, `Chat`, `Outputs`; rotated where it does not fit at 12 px, never abbreviated) and its key number `1` to `6` printed on the tab, then the panel. Rail, width and collapsed state live in the URL so a crash reloads the same layout. Backtick collapses the drawer; the monitor grows into the space. (PRO-8, REM-10)

### 3.2 Always visible vs in the drawer

Always visible: top bar, PROGRAM, PREVIEW, GO, program strip, macro slots, evening timeline, status line. Nothing else.

In the drawer, one at a time:
- **Layers**: an independently scrolling layer strip (X / B / S, opacity fader, blend dropdown, thumbnail on the selected row, VJ-3) in the top half; a drag handle; below it the effect chain of the selected layer in its own scroll region, each effect a collapsible card with single-column ParamControls, most-used first, advanced in a sub-panel (PRO-5). Twenty layers at 32 px are 640 px; the split defaults to 45 / 55 and remembers itself.
- **Modulation**: a sources strip (SourceChips: audio bands, LFOs, macros, agent) and below it the matrix, one two-line row per routing (line 1: source chip, amount knob, target path with ellipsis; line 2: curve, bypass, drag handle). Wide mode (60%) lays the row out on one line like Graph. Filtered to the selection unless pinned. (DAW-2, DAW-3)
- **Mapping**: outputs list, surfaces of the selected output (corner pin, mesh warp, edge blend), numeric fields for the selected corner. Opening it puts PREVIEW into `OUTPUT n` mode and draws the handles on PREVIEW; PROGRAM stays live. A `Lock mapping` toggle in the panel header is on by default when the show is running. (VJ-10, VJ-12)
- **Graph**: node graph, wide mode (drawer takes up to 60%, monitors shrink like Resolve's Color page viewer). Typed ports left in, right out; wire hue = family; auto-arrange default; breadcrumb and minimap. Authoring only, never needed during a set. (DAW-12, PRO-11)
- **Chat**: see 3.4.
- **Outputs**: engine, supervisor, projectors, resolution, fps, the Outputs monitor variant, restart engine, logs.

### 3.3 Selection and the drawer

- There is one global selection: a layer, an effect, a program step, a surface, a node, or nothing.
- Selecting sets PREVIEW (a step previews its look, a layer previews that layer solo, a surface previews that output) and updates the open panel if the panel can show the selection. It never switches panels on its own (PRO-9, the Figma auto-hover lesson).
- Enter or double-click on a selection opens its natural panel (layer to Layers, routing to Modulation, surface to Mapping, node to Graph).
- `Pin` in the drawer header freezes the panel on the current selection; the header shows the pinned name. A second selection then only updates PREVIEW and the chat's `Selected:` chip. Unpin returns to follow mode. (PRO-6)
- Nothing selected: Layers shows the composition-level list, Modulation the whole matrix, Chat the program-level context.
- Drawer header always has `/` search-as-you-type (closes with Cmd+. or click-outside, never Escape), a `differs from default` dot on any changed control with right-click reset, and a Favourites strip of up to six starred controls at the top. (PRO-6)

### 3.4 Chat and tool calls

- Chat is the drawer's Chat panel, 360 px, never wider. `Pop out` detaches it into a floating always-on-top window (for a second monitor) and hides it from the rail; PROGRAM takes the width. (AI-1, AI-2)
- Inline tier: with a layer, effect or step selected, Cmd+K shows a one-line prompt bar anchored at the selection in the drawer (`make this pulse to the kick`, `warmer`). The answer lands as a card in Chat; the bar closes on send, Cmd+. or click-outside. Escape does not close it; Escape is panic (3.8). (AI-9)
- Above the composer, context chips with an eye toggle each: `Program: Friday Techno`, `Selected: Layer 3 / Feedback`, `Audio: live 128 BPM`, `Preview frame`. (AI-6)
- Mode selector left of Send: `Auto`, `Accept edits`, `Manual`, `Plan`. Cmd+Shift+U cycles. (AI-5)
- **Cmd+Enter sends.** Enter inserts a newline and Space inserts a space; while the composer has focus the status line reads `Keys: Typing` and no single-key shortcut fires. (principle 8)
- Tool calls render collapsed as one line each (`read show file`, `set layer 3 feedback amount 0.4 → 0.7`); a chevron expands to verbose. (AI-8)
- Every change is an AgentCard: a `agent`-hued left rule, one line of what changed, a `+n -n` badge, `Keep` and `Undo`. A checkpoint tick sits in the gutter per turn; clicking it previews the show state at that turn in PREVIEW and `Restore` reverts the show file while keeping the chat; the restore itself is one more undoable step. (AI-3, AI-4)
- Destructive classes (delete layer, replace output mapping, restart engine, replace program, change blackout state) always produce an Allow / Deny card with a before/after thumbnail, whatever the mode. Parameter tweaks in `Accept edits` apply live with only the badge. (AI-5)
- `Stop` is always visible while the agent runs, in the panel and on the status line; typing during a run queues a correction without stopping. (AI-10)
- `/` at the start of the composer opens quick actions (`/calm`, `/double`, `/next-mood`, `/undo-last`), each a saved prompt with a hotkey. (AI-11)
- Variations: when asked for a new look, the agent returns three thumbnails stacked full-width in the panel (about 300 x 170 px each); Up / Down cycle while the panel has focus, the hovered or focused one is mirrored in PREVIEW, GO commits. (AI-9)
- Every agent write is also a MatrixRow or a keyframe on the timeline's agent lane, so the human can always see it outside the chat.

### 3.5 Program strip and evening timeline

**Program strip = "now"** (Millumin columns, VJ-5, plus Ableton cell state, DAW-7).
- One cell = one program step: number, name, transition (`fade 2.0 s`, `cut`), duration or loop, follow-action chip (`→ next 8 bars 100%`, `→ any 50%`, `■ stop`).
- State on the cell is a **word chip first, outline second**: on air = `live` fill with a black dot top-right, the chip `LIVE` and a pie (loop) or progress bar (one-shot); next = the chip `NEXT` in `live` plus a 2 px outline; selected = neutral selection; steps whose armed values differ from live show the chip `DIFFERS` in `warn` (hatched) with the values. Two chips never share a cell at the same size.
- Click = select (PREVIEW shows it). Space or the GO button fires the `NEXT` step with its transition; double-click fires that cell. Left / Right arrows move `NEXT`. Space is `preventDefault`ed outside text inputs so it never scrolls the page or re-presses a focused button.
- `Back to program` sits pinned left of the scroller, lit in `warn` whenever a macro or the agent has moved a value off the program's value; clicking it returns to program values with a 1 s fade. (DAW-7)
- Edit mode (Cmd+Shift+E) unlocks drag-reorder, rename and transition editing; outside edit mode cells cannot be moved. (VJ-5)
- Macro row: eight MacroSlots in fixed order, labels from the current step, value bars in `sig-macro`. Named variations (`Look A`, `Look B`) and `Rand` with per-slot exclude sit at the row's right end. `Look A` / `Look B` apply on click because they are named, known states; **`Rand` lands in PREVIEW and needs GO** (principle 2). (VJ-7, DAW-4, DAW-6)

**Evening timeline = "tonight"** (Vezer queue, DAW-13, DAW-9).
- Clock axis 22:00 to close; `▼ now` in `live`; blocks are program steps or sub-programs with start times; the on-air block has the dot; played blocks draw at 60% with the word `done`.
- Cue markers on the lane: `◆` marker, `■` stop, `↷` jump, drawn as glyph plus short label.
- Typed lanes (float, colour, flag) collapsed under the block lane; agent edits land there as keyframes in `agent`. Expand only to inspect.
- `Follow` in the top bar is the global enable for follow actions and timeline auto-advance; off means nothing advances by itself. When it is on, the next auto-advance is printed where the operator looks: `auto → 4 Breathe in 12:40` on the PREVIEW caption and on the phone now/next line. (DAW-8)
- When the human fires a step manually while the timeline is running, `Timeline overridden · Back` lights in `warn` on the status line (pinned, so it never scrolls away) and on the timeline's left edge.

### 3.6 Blackout, master, restart

- Master cluster is fixed at the top-left of the top bar and at the top of the phone header. (VJ-2, REM-1)
- `Blackout` is a state of the engine with **three phases, and the button prints its phase.** The same three lines apply on the phone (4.2), verbatim:
  1. **Live.** Laptop: single click on the button, or Escape. Phone: hold 600 ms. Either starts the soft blackout (fade over the panic duration, default 1.5 s). Label: `Blackout` (laptop) / `Hold to Blackout` (phone).
  2. **Fading (0 to panic duration).** Any Blackout press or Escape is the hard cut, immediately, with no lockout; escalation is never swallowed. Label: `Cut Now`. PROGRAM overlay: `FADING`.
  3. **Black (fade complete or hard cut).** Tap, click or Escape = Restore. The 1 s re-trigger lockout guards **only** Restore: a Restore press inside the lockout flashes the `critical` border and is ignored (REM-6). Label: `Restore`. State shown by PROGRAM's 3 px `critical` frame with the word `BLACK`, the top-bar badge and the button's `critical` fill. (REM anti-pattern 2, REM-5)
- Escape is the panic key and is exclusive: nothing else in the app closes, cancels or blurs on Escape, and Escape fires regardless of focus, including from inside the chat composer, a rename field or a typed value. Not remappable. QLab hardcodes the same rule for the same reason: "A single press of the escape key is always assigned to panic, and a double press of the escape key is always assigned to hard stop" (https://qlab.app/docs/v5/fundamentals/workspace-settings/). The difference from QLab is deliberate: our second press is a hard cut only during the fade, and a restore once black, so the button's phase word always tells you what the next press does.
- Master fader turns `critical` and shows its value whenever it is below 100; at 100 it is neutral. Master is a ParamControl, so Shift-drag is fine and double-click types. A `Full` button appears beside it whenever it is below 100. (VJ-2)
- `Freeze` holds the last frame on all outputs while the operator edits; PROGRAM shows `FROZEN` in `warn`. (VJ-12)
- The agent cannot leave blackout without an Allow card.
- **Restart talks to a supervisor, not to the engine.** A launchd or watchdog process on the Mac Mini owns the engine process and answers its own 1 s heartbeat; the top bar and phone header show both (`Engine offline · Supervisor ok`). Restart stays enabled whenever the supervisor answers, which is exactly the hung-engine case. The restart sheet copy names what restarts: `Restarts the engine process. Supervisor stays up. Output goes dark for about 8 s. Program resumes at step 3.` Not verified whether vjai has a supervisor today; if not, this is an engine requirement (open item 7).

### 3.7 Modulation on a parameter

Every parameter is a ParamControl: a horizontal bar, label left, value right in JetBrains Mono 13 px. (GL-8, VJ-8)

- Unmodulated: track in `border-strong`, fill in `text-mid`, no ring, no badge. This is the hierarchy; most controls look quiet. (GL anti-pattern "rings on every knob")
- Modulated: a translucent band in the source hue spans the modulation range on the track; a 2 px marker in the source hue shows the live modulated value in real time; a small badge at the right end shows the source glyph and letter (`◉A` audio, `∿L` LFO, `◻M` macro, `✦AI` agent). Up to three badges, then `+n`.
- Drag the band's edge to set depth (Bitwig ring-drag, DAW-1). Drag a SourceChip onto the bar to add a source; eligible targets brighten, everything else dims to 60%; hovering auditions. (DAW-2, GL-9)
- Right-click: list of sources with amount, bypass and remove, plus `Reset to default`. (DAW-3)
- Hotkeys on the hovered control: `D` default, `R` random, `L` lock. They obey the key router (3.8): never while a text field has focus. A locked control shows a small `Locked` badge in `text-mid` and the agent cannot write it. (VJ-bonus)
- Knob variant with a ring exists only in the Modulation matrix amount column, where the ring metaphor pays for its space. Ring hue = source; ring at 60% opacity when amount is zero.
- Drag behaviour everywhere: plain drag coarse, Shift fine, Alt beyond range, double-click types (with math: `0.5*2`), right-click resets. **Wheel edits a value only with Alt held or after the control was clicked (it then owns the wheel until the pointer leaves); plain wheel scrolls the drawer.** (VJ-8, GL-8)

### 3.8 Keyboard shortcuts

**Focus rule (one key router, one visible owner).** Single-key shortcuts fire only when focus is not in an editable element (chat composer, inline bar, search, rename, typed value). While one has focus the status line shows `Keys: Typing` in `text-mid`; otherwise `Keys: Stage`. Every stage control (GO, Blackout, Freeze, Follow, macro slots, program cells) has `tabindex=-1` and blurs itself on click, so a mouse click on Freeze followed by Space fires GO, not Freeze (browsers otherwise keep focus on the clicked button and Space activates it, https://www.w3.org/WAI/ARIA/apg/patterns/button/). Space is `preventDefault`ed outside inputs. **Escape is the one exception: it reaches panic from any focus.** Every combo below was checked against the Chrome (https://support.google.com/chrome/answer/157179) and Safari (https://support.apple.com/guide/safari/keyboard-shortcuts-and-gestures-cpsh003/mac) lists; the v1 bindings Cmd+L (address bar in both), Cmd+Shift+M (Chrome profile menu), Cmd+E (Chrome find), Cmd+I (Safari "Email this page") are gone.

| Key | Action |
|---|---|
| Space | GO: fire the `NEXT` program step with its transition (Stage focus only) |
| Left / Right | move `NEXT` (previews it); on a focused slider they move the slider, which is why stage controls never keep focus |
| Escape | panic, any focus: Live → soft blackout; Fading → hard cut; Black → restore (fixed, not remappable, exclusive) |
| F | Freeze / Unfreeze |
| Shift+F | PROGRAM full-screen (in-page mode); Shift+F again exits; every other key keeps working |
| V | swap PROGRAM and PREVIEW sizes |
| Cmd+Shift+E | program edit mode |
| Cmd+K | inline agent prompt at the selection |
| Cmd+/ | focus chat composer (status line flips to `Keys: Typing`) |
| Cmd+Enter | send chat / send inline prompt |
| Cmd+. | close the inline bar, search or a sheet (never Escape) |
| Cmd+Shift+U | cycle agent mode |
| Cmd+Z / Cmd+Shift+Z | undo / redo on the show file only (see 3.9) |
| 1 to 6 | drawer panel (Layers, Modulation, Mapping, Graph, Chat, Outputs); printed on the rail tabs |
| ` | collapse / expand drawer |
| P | pin / unpin drawer |
| / | search in the drawer |
| Cmd+Shift+K | Learn mode |
| Cmd+Shift+L | UI lock |
| D / R / L on a hovered control | default / random / lock (Stage focus only) |
| Shift / Alt while dragging | fine / beyond range; Alt+wheel nudges |

### 3.9 Undo scope

- Cmd+Z / Cmd+Shift+Z operate on the **show file only**: authoring edits by the human or the agent, agent-card Undo / Keep, checkpoint Restore. The stack is one stack; a card's `Undo` is a labelled entry in it, so Cmd+Shift+Z redoes it.
- **Transport is never in the stack**: GO, blackout, hard cut, restore, freeze, master drags, live macro moves, `Rand`. A stray Cmd+Z can never re-fire a step or lift a blackout.
- Performance overrides (macro or agent values moved off the program's values) are cleared only by `Back to program`; the timeline override only by `Back to timeline`.
- The stack top is always printed on the status line (`Undo: layer 3 feedback`) so the operator sees what a Cmd+Z will do before pressing it. Principle 5 holds: the engine is the source of transport truth; the show file is the source of undo truth; they never arbitrate each other.

---

## 4. Phone "Dashboard" layout

Portrait, 390 x 844 pt reference. **A standalone Home Screen web app** (manifest with `display: standalone`, service worker), not a bookmark: on iOS only a Home Screen web app can ask for push, and only from a user gesture (https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/: a site without a manifest "will be saved as a Home Screen bookmark"). A one-time `Allow notifications` tile sits on Home until granted or dismissed. Home requests a Screen Wake Lock while it or the output grid is visible (Safari 16.4+, https://caniuse.com/wake-lock) and prints `Screen stays on` in the header; when the lock is denied or lost the header says `Screen may sleep` (principle 5). (REM-10)

```
+----------------------------------+
| ● LIVE   Friday Techno           |  header (120 pt incl. safe area): state, program
| Master 100 · Engine 0.3 s · Agent idle · Screen stays on |
+----------------------------------+
|        preview stream            |  150 pt band, letterboxed, 80% brightness
|        tap: expand / outputs     |
+----------------------------------+
| now  3 Peak ● 02:14   next 4 Breathe   auto → in 12:40 [Hold] |  now / next, status only
| Agent: changed layer 3 · Undo · Stop  |  action line (only when something needs you)
+----------------------------------+
|                                  |
|      HOLD TO BLACKOUT    ◔       |  hero (96 pt), 12 pt clearance, fixed, no scroll
|                                  |
+----------------+-----------------+
|     GO ▶       |   PROGRAM       |  quick tiles (72 pt)
+----------------+-----------------+
|   CHAT  ● 1    |   OUTPUTS       |
+----------------+-----------------+
|   HOLD TO RESTART  · Supervisor ok |  full-width row (56 pt), 12 pt clearance
+----------------------------------+
|  Home    Macros    Chat    Lock  |  bottom tabs (56 pt + safe area)
+----------------------------------+
```

Vertical budget on 390 x 844: header 120 + preview 150 + now/next 56 + action line 24 (only when shown) + hero 96 + 12 + grid 152 + 12 + restart 56 + tabs 56 + home indicator 34 + region gaps 48 = 816 pt. Nothing on Home scrolls; the macro sliders live only on the Macros tab.

### 4.1 Regions and thumb zones

- **Header (top, status only, never a button; `env(safe-area-inset-top)` padding).** Two lines. Line 1: state badge (same precedence as the laptop: Offline > Black > Frozen > Stale > Master low > Live) and program name. Line 2: `Master 100`, `Engine 0.3 s` (word plus age; `Stale` / `Offline` when degraded), `Supervisor ok`, agent word, wake-lock word. The 28 pt hero readout is used for **one** number: the engine age, or the master value while it is under 100. `Link n` appears here only if Ableton Link is running, next to the BPM. (REM-1)
- **Preview (150 pt band).** One low-fps stream of the **composition** (what PROGRAM shows on the laptop), letterboxed into a fixed 150 pt band at 80% brightness; the last frame stays with a grey wash and `STALE n s` when the engine degrades. Tap expands it to full-screen, a second tap opens the per-output grid (one tile per projector), a single tap exits. Long-press does nothing. (REM-recommendation, PRO-2)
- **Now / next line (status row, no buttons).** On-air step with its progress, next step, and when `Follow` is on: `auto → 4 Breathe in 12:40` with a `Hold` toggle that pauses auto-advance from the phone.
- **Action line (appears only when something needs you, otherwise 0 pt).** Mirrors the laptop status line so the phone never shows a problem without its action: `Master 62 · Full`, `Agent: changed layer 3 · Undo · Stop`, `Timeline overridden · Back`, `Agent needs you · Open`. Each is one 48 pt row; at most two stack.
- **Hero: Blackout (thumb zone begins here).** Full width, 96 pt, `surface-2` with a `critical` outline; label is the phase: `Hold to Blackout` / `Cut Now` / `Restore` (3.6).
- **Quick grid 2 x 2, 72 pt each, 8 pt gaps:** `GO` top-left (72 pt, 12 pt from Blackout, single tap, 1 s lockout), `Program` (opens the step list as a sheet; a step in the sheet is `Skip`: it moves `NEXT` and previews it, it never fires), `Chat` (badge with count of cards needing you), `Outputs` (per-output grid, system sheet with logs). No long-press on the grid; tile order is edited in the Outputs sheet. (REM-3)
- **Restart row:** full-width 56 pt below the grid with 12 pt clearance, `Hold to Restart`, with the supervisor word beside it. Never diagonal from Chat.
- **Macros tab:** the same eight slots in the same order as the laptop, 56 pt tall, value inside the thumb, source badge at the right if modulated; a `Variations` row (`Look A`, `Look B`, `Rand`) above them. `Look A` / `Look B` are single tap; `Rand` is hold-to-apply with the same 600 ms ring, because the phone cannot preview it. Tracks carry `touch-action: pan-y` so a scroll that starts on a track scrolls; only the thumb carries `touch-action: none` and captures the drag (https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action). (DAW-4, DAW-6)
- **Bottom tabs:** `Home`, `Macros`, `Chat`, `Lock`; visible tabs, no hidden gestures; `env(safe-area-inset-bottom)` padding. (REM-2)

Hit sizes: nothing under 48 pt, 8 pt gaps, 12 pt around Blackout; text 15 pt body, 17 pt buttons, 13 pt labels; all numbers tabular. (GL-6)

### 4.2 Confirm patterns

- **Hold gesture mechanics (hero, Restart, Rand).** The hero, quick grid and restart row are a fixed, non-scrolling region with `touch-action: none`, `-webkit-touch-callout: none` and `user-select: none`, so iOS neither shows the touch-and-hold callout (https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-touch-callout) nor selects the label. Pointer Events with `setPointerCapture` on `pointerdown`; the ring starts drawing at `pointerdown` with no delay so progress is visible before iOS's own long-press threshold (roughly half a second; Apple does not publish the Haptic Touch values, not verified beyond https://developer.apple.com/forums/thread/772660); `pointercancel`, `pointerleave` and release before 600 ms all cancel with no effect.
- **Blackout:** the three phases of 3.6, verbatim: Live: hold 600 ms, ring fills around the label, release early cancels, label `Hold to Blackout`. Fading: any press = hard cut, no lockout, label `Cut Now`. Black: tap = Restore, 1 s lockout guards only Restore with a red border flash on an ignored press, label `Restore`. On completion the button turns solid `critical`, the header flips to `BLACK`, the preview frames red. (REM-5, REM-6)
- **Restart:** hold 600 ms opens a bottom sheet on `surface-3` that states the consequence in one line (`Restarts the engine process. Supervisor stays up. Output goes dark for about 8 s. Program resumes at step 3.`) with `Restart now` and `Cancel`; the sheet dismisses on tap outside. Enabled whenever the supervisor answers, even when the engine is offline. (REM-4)
- **GO:** single tap, 1 s lockout, red flash if ignored. It is the only tile that fires anything.
- **Never** expose Blackout, Restart or GO through a widget, lock-screen control or notification action. (REM anti-pattern 3)

### 4.3 Connection-lost state

- Two heartbeats every 1 s: engine and supervisor; the header shows the engine's last-frame age as a number at all times and the supervisor as a word.
- Over 2 s: header age turns `warn` with the word `Stale`; the control area dims to 40% with the word `Stale` printed over it; buttons stay visible but disabled, **except Restart, which follows the supervisor heartbeat**; preview keeps the last frame under a grey wash.
- Over 10 s: `Offline` in `critical`, plus `Reconnecting` with the attempt count. Reconnect is automatic with backoff; there is no pull-to-refresh and no toast. On reconnect the state is re-read from the engine before any button re-enables. (REM-9, REM anti-pattern 4)
- Any degraded mode (agent offline, preview off, read-only, screen may sleep) is a word in the header, not a dead button. (REM anti-pattern 5)

### 4.4 Lock

`Lock` tab or 30 s idle in a pocket-detected state: the screen keeps header and preview, hides nothing, but every control needs a swipe-to-unlock first. The agent still pushes cards; they wait behind the lock. (REM-8)

### 4.5 Chat sheet

- Opens as a bottom sheet over the dashboard from the `Chat` tab or a push notification; drag down or tap outside dismisses. Only the sheet content scrolls. (PRO-8)
- Shows outcomes, not the stream: each agent turn is one AgentCard (`Changed layer 3 feedback 0.4 → 0.7`, `+2 -1`, `Undo`), Allow / Deny cards with a before/after thumbnail, and variation rows of three thumbnails to swipe. (AI-12, AI-9)
- The composer has the same context chips as the laptop, condensed to `Program`, `Selected`, `Audio`.
- Quick actions as one-tap chips above the composer: `Calm it down`, `Double the intensity`, `Next mood`, `Undo last`. (AI-11)
- Push notification only when a task finishes or needs a go-ahead; the notification opens the card, never performs an action. (AI-12)

---

## 5. Component inventory

Each with its states. All components draw only from engine state (principle 5).

1. **StatusHeader** (laptop top bar right half, phone header). States: live, black, fading, frozen, master-low, stale, offline, supervisor-offline, locked, learn, wake-lock on / off, agent idle / thinking / editing / needs-you / failed. Badge slot follows the precedence rule; lower states remain as words.
2. **MasterCluster**: Blackout button (live, holding with ring on phone, fading with `Cut Now`, black with `Restore`, restore-lockout), Master fader (full, reduced with red value and `Full` button, dragging), Freeze (off, on).
3. **Monitor**: program, preview and outputs variants; side-by-side or stacked band. Overlays: none, BLACK, FADING, FROZEN, STALE, OUTPUT n (mapping handles on), full-screen (in-page), swapped. Preview variant also carries `NEXT` and `selected` captions, the `auto → in mm:ss` caption, and GO with its fade time.
4. **ProgramCell**: idle, `NEXT` chip, on-air `LIVE` chip (loop pie / one-shot bar), selected, `DIFFERS` chip (values in `warn`, hatched), disabled in edit-lock, dragging in edit mode, out-of-scope at 60%.
5. **TimelineLane**: block (upcoming, on-air, `done` at 60%), now marker, cue glyphs (marker, stop, jump), agent keyframe lane collapsed / expanded, collapsed 32 px mode, back-to-timeline lit.
6. **MacroSlot**: value bar with label, modulated badge, locked, excluded-from-rand, phone 56 pt variant with pan-y track and capturing thumb; Variations row with Rand (preview-and-GO on laptop, hold on phone).
7. **Drawer**: rail tabs 64 px (active, inactive, badge for chat, key number printed), header (title, pinned name, search, favourites), width normal / wide / collapsed, panel body, split handle in Layers.
8. **LayerRow**: compact 32 px and 56 px variants; X / B / S (each off / on), opacity fader, blend dropdown, thumbnail, selected, bypassed at 60% with `B` lit, solo highlight, drag handle in edit mode.
9. **ParamControl**: bar and knob variants. States: default, hover with readout, dragging, fine (Shift), typing, wheel-owned (after click or with Alt), differs-from-default dot, modulated (band, marker, badges), drop-target eligible, ineligible at 60%, locked, learn-outlined with protocol letter, disabled at 40%.
10. **SourceChip**: idle, dragging, armed (flashing outline), meter showing live source value, bypassed.
11. **MapSurface**: surface row (selected, locked, hidden) and on-monitor handles (corner idle, corner hover, corner dragging, mesh point, locked-no-handles).
12. **GraphNode**: family hue, generator vs filter tint, ports typed, selected, bypassed, wire idle / active-animated, reference link dashed, drop-on-node popup open.
13. **AgentCard**: change (pending, kept, undone), allow / deny (waiting with `warn` rule, allowed, denied), tool-call line (collapsed, expanded), checkpoint tick (idle, previewing, restored), variations (three stacked thumbnails, focused one mirrored in PREVIEW), error.
14. **ChatComposer**: context chips (on / off), mode selector, Send (Cmd+Enter), Stop while running, queued correction, quick-action chips, inline variant anchored at a selection; sets `Keys: Typing` while focused.
15. **ActionButton** (phone): hero-hold (idle, holding with ring, fired, cut-now, restore, lockout flash, disabled-stale), quick tile (idle, pressed, badge, disabled), GO (idle, lockout), restart row (idle, holding, disabled only when the supervisor is offline).
16. **ActionLine** (phone) / **StatusLine** (laptop): agent activity with Undo and Stop, undo-stack top, keys owner, timeline override with Back, master low with Full.

MatrixRow is a composition of SourceChip, ParamControl (knob), a target label and a bypass toggle on two lines, not a separate component.

---

## 6. What we reject, and why

From the anti-patterns in `docs/research/ui-references.md`:

- **Monitors squeezed into a corner or hidden by panels** (Resolume default). The monitors are the layout; everything else fits around them, and PREVIEW has a 320 px floor so it never becomes the Resolume corner monitor.
- **A 16:9 monitor slot for a 5:1 canvas.** PROGRAM is drawn at the composition's real aspect; wide compositions stack the monitors instead of ribboning them.
- **Free-floating windows and hover-revealed or auto-hiding panels** (VDMX, Figma UI3 beta). One fixed, resizable drawer; the only floating thing is the optional popped-out chat.
- **Blackout as a fader at zero or an unmapped key; blackout three menus deep** (Resolume, Millumin). Blackout is a first-class engine state with a fixed top-left home on both devices, a non-remappable exclusive key, and a button that prints its phase.
- **A master fader with no state colour.** Master under 100 is always red with its value and a `Full` action.
- **Node graph or element tree as the performance surface** (Notch, Smode). The graph is an authoring panel; what performers touch are the eight macro slots.
- **Program steps without transitions** (Synesthesia). Every step has a fade time; the strip cannot express "cut to black, switch, fade up" by accident.
- **Everything on screen at once** (Live 12 on a laptop, the first vjai mockups). Six regions always visible, one drawer panel, nothing else.
- **Unbounded property panels** (Nuke default 10). One selection, one panel, a pin.
- **Icon-only controls, abbreviations, "Enable X" labels, negative tooltips** (Figma pre-UI3, Blender's banned list). Every control has a visible Title Case word, including the drawer rail.
- **Modal dialogs over the output** (Blender HIG). Guards are hold gestures and bottom sheets that dismiss on tap-outside.
- **Meaning carried by spatial arrangement.** Ports are typed and labelled; macro order is memorised, but the slot also carries its number and name.
- **Meaning carried by hue alone.** Three hue-neighbour status colours each have a form and a word; opacity always comes with a word or a lit glyph.
- **Flat, uniform darkness with no elevation cue** (UE5 "too dark" threads) and, at the other end, **pure black / pure white**. Four tonal tiers, text at 87 / 60 / 38.
- **Saturated neon accents** and **grey-on-grey secondary text**. Desaturated accents, every pair checked against 4.5:1 / 3:1 with the numbers in 2.1.
- **Shadows as elevation, thin type, skeuomorphic knobs with inset labels.** None of them.
- **Modulation rings on every control with no hierarchy.** Unmodulated controls draw nothing; knobs exist only in the matrix.
- **Rainbow-coloured macro slots** (Bitwig). Good for hardware, but it would spend eight hues we reserved for meaning; position and number carry the memory instead.
- **Touch targets under 44 pt, no gaps, proportional digits on readouts.** 48 pt, 8 pt gaps, tabular numerals everywhere.
- **Sliders inside a scrolling list** (the v1 phone Home). Home does not scroll; slider tracks pan the page, only the thumb drags.
- **Hidden gestures as the only route to system controls** (Sonos 2024). Visible tabs and buttons; no long-press-to-reorder next to the blackout hero.
- **Buttons that mix state and action labels** (Tesla). Labels are the next action (`Blackout`, `Cut Now`, `Restore`); state lives in the header and the monitor frame.
- **Destructive actions in widgets or notifications** (Tesla frunk). Blackout, restart and GO exist only inside the unlocked app.
- **Reconnect toasts that lie, lag that grows, silent read-only downgrades** (Home Assistant, grandMA3 web remote, QLab Remote). Age as a number, automatic reconnect, degraded modes as words in the header.
- **A restart button that dies with the process it restarts.** Restart goes through a supervisor with its own heartbeat.
- **Keys with two owners** (browser tab shortcuts, focused buttons eating Space, Escape as both dismiss and panic). One key router, the owner printed on the status line, Escape exclusive, the workbench installed so the browser owns nothing.
- **Agent edits applied without a review card; agent-first layouts that hide the work; irreversible revert; silent agents; timed auto-accept with no countdown; verbose-by-default logs** (Cursor 2.5.20, Cursor 3, Windsurf, Linear's unresponsive rule). Cards with Keep / Undo, chat in a drawer, undoable restore, a status line that changes within a second, collapsed tool calls.
- **Free-form node canvas with no cable management and unrecoverable deletes** (FL Patcher). Auto-arrange by default, typed wires, every delete undoable, presets overwritable.

---

## 7. Open items

1. Panic fade duration default (1.5 s) and Restore lockout (1 s) are starting values; tune on the real rig.
2. Whether the timeline's typed lanes need a full keyframe editor in v1 or only read-only inspection of agent edits.
3. Pocket detection for auto-lock on the phone depends on what the browser exposes; the manual Lock tab is the guaranteed path.
4. Verify the dotted zero in JetBrains Mono reads well at 13 px on the laptop; fall back to IBM Plex Mono (also OFL, self-hosted the same way) if not.
5. Self-hosted font fallback: measure `size-adjust` for the system fallbacks so the 20 / 28 px readouts hold their width with the fonts missing.
6. Cmd+Shift+U (agent mode) and Cmd+K (inline prompt) are not on either browser's list; confirm inside the installed-app window on the actual Mac, since installed apps still route a few combos to the browser.
7. Supervisor process: not verified that vjai has one. If not, it is an engine requirement (launchd-managed engine, supervisor endpoint with a 1 s heartbeat and a restart call) before the Restart button can be trusted.
8. iOS Haptic Touch threshold is not published; test the 600 ms hold with the CSS in 4.2 on the actual phone at Fast / Standard / Slow settings.
9. Composition aspect on the real rig (how the 3 to 5 outputs are arranged) decides whether the stacked or side-by-side monitor band is the everyday layout; the 2.4:1 switch point is a starting value.

---

## 8. Considered and rejected

- **Escape kept for UI dismissal, blackout on a held key (critique "browser-suicide pact").** Rejected: the collisions it lists (fullscreen exit, dropdown close, inline bar, search) are removed by the exclusive-Escape rule, the in-page full-screen mode and the installed-app window, and a 600 ms hold is slower than QLab's single-press panic that the operator already has in muscle memory. Its full-screen fix (only Shift+F exits, Space and arrows keep working) is adopted in 3.1 and 3.8.
- **Double-Escape = soft, triple or held = hard, single Escape = dismiss.** Rejected for the same reason: a panic key that needs two presses is not a panic key.
- **Tappable red master value in the phone header.** Rejected as stated; the header stays status-only (a tap zone at the top of the screen next to the state badge is the one place we do not want an accidental fader). The action moves to the new action line under now/next as `Master 62 · Full`, which reaches the same fader and `Full` button.
- **`Skip` tile in the quick grid.** Rejected as a tile; the grid slot goes to GO in the thumb zone, and Skip lives on each step inside the Program sheet, where it reads as "make this next".
- **Restart moved into the Outputs / System sheet.** Rejected: the phone's stated purpose is status plus blackout / program / restart. It stays on Home as its own full-width row below the grid, out of the 2 x 2 and away from Chat.
- **Darker amber for `warn` (hue 24 to 26).** Computed and rejected: candidates at hue 25 to 28 fall to 1.04 to 1.10:1 against `critical`, worse than the current 1.19:1. Form (hatch plus outline) and a word carry the distinction; the hex stays.
- **Wheel edits with plain scroll on the laptop (FabFilter).** Rejected because the drawer scrolls; kept only with Alt or after a click on the control.
