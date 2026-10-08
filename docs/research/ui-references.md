# vjai UI references

Consolidated from six research sweeps (VJ software, DAWs and synths, pro creative tools, AI agent surfaces, remote/show-control apps, platform guidelines). Every URL from the sweeps is kept. Each category ends with "What we take", which is what the design brief (`docs/design/brief.md`) is built from.

Context these were read against: a Mac Mini drives 3 to 5 projectors headless in a Budapest club. The owner controls it from a phone (status, blackout / program / restart, macro sliders, preview stream, chat with the agent that edits the show) and from a laptop browser (layers with effect chains, projection mapping, audio-reactive modulation, node graph, chat, program timeline). Laptop = "stage" layout (big preview, program strip and evening timeline below, one drawer panel at a time). Phone = dashboard first. Dark room, 3am, tired eyes, must read at a glance.

Legend for verification status: (V) read from the source page, (S) taken from a search snippet or indexed summary because the page could not be fetched, (N) not verified, do not rely on it.

---

## 1. VJ software (Resolume, Millumin, MadMapper, HeavyM, VDMX, Notch, Smode, Synesthesia)

### Patterns

**VJ-1. Two monitors: "what the audience sees" and "what I am about to send", side by side, never merged.** (V)
Resolume Arena 7: clicking a clip thumbnail fires it to the Composition monitor; clicking its name only selects it for the Preview monitor. Double-clicking a file in Files previews it. Layouts let you add monitors pointed at Composition, Preview, a Group, a Layer or the Crossfader mix. The destructive action (go live) and the safe action (look first) are different click targets.
- https://resolume.com/support/en/clips
- https://resolume.com/support/en/layouts
- https://vjacademy.info/resolume-arena-guide

**VJ-2. Master and bypass live top-left, and the master turns red whenever it is not at 100%.** (V)
Resolume: "The B button bypasses the entire output, the M slider gives you the same control under a fader... it will show red when not set to 100%." Millumin's Monitor window has a Masters tab (video opacity, audio volume, DMX intensity). VDMX puts a MASTER FADER at the top of the Workspace Inspector "as a quick way to fade to black". One fixed location, one colour meaning "you are not at full output", both a fader and a hard switch.
- https://resolume.com/support/en/composition
- https://help.millumin.com/docs/connect/monitor/
- https://docs.vidvox.net/vdmx/vdmx_rendering.html

**VJ-3. Per-layer strip: three one-letter hard controls (X eject, B bypass, S solo), vertical opacity fader, blue highlight for the selected layer.** (V)
Resolume layers: every row shows X/B/S, the V fader, blend dropdown, thumbnail; "the currently selected layer is highlighted in blue". Same shape for every layer, so the eye learns positions; selection is visually separate from playing state.
- https://resolume.com/support/en/layers

**VJ-4. Played vs edited are two states with two marks on the same tile; blackout is a first-class empty state.** (S)
HeavyM Sequences: "the played sequence is the one whose tile is yellow, with a black dot in the top right corner"; a sequence can be edited without being played; clicking an empty cell means no played sequence and "the rendering is blacked out". Only one sequence plays at a time.
- https://help.heavym.net/hc/en-us/articles/9172868530066-Module-1-the-Sequences (403 on fetch; wording from search snippet)
- https://help.heavym.net/hc/en-us/articles/9172061701138-The-Sequencer

**VJ-5. Show as a strip of columns: one column = one moment, SPACE launches the next, edit mode is a separate mode.** (V)
Millumin 4 Dashboard: "Each column of the dashboard represents a moment/event of your show"; default 14 columns; per-column gear for title, notes, colour, transition; collapsible time panel with elapsed/remaining; edit mode (CMD+E) so you cannot move media while performing; timelines import as columns.
- https://help.millumin.com/v4/playback/dashboard/
- https://help.millumin.com/v4/general/getting-started/
- https://help.millumin.com/v4/playback/timeline/

**VJ-6. A "next" preview grid: previous / current / next column, a layer, or an input, low fps, lockable.** (V)
Millumin Preview Grid: default 4x4, each slot shows "the content of the previous, current, next or selected column", a layer or an input; frame rate adjustable; the grid locks once configured "to prevent accidental changes during show operation".
- https://help.millumin.com/?page=02_tutorials_advanced/preview-grid

**VJ-7. Dashboard of 8 promoted parameters at every scope (clip / layer / group / composition).** (V)
Resolume Dashboard: "When driving, you don't need to know everything about how the engine is doing." Drag any parameter (toggles, dropdowns, colours too) onto a dial, several onto one dial; performers get "instant access... without having to dig down into the effect stack".
- https://resolume.com/support/en/dashboard

**VJ-8. One slider widget: drag the bar, click the number to type (math allowed), right-click to reset, modifiers for fine / snapped / out-of-range.** (V for Resolume, S for Notch)
Resolume: drag, click value to type, "type 1920 / 3 and Resolume will do the math", right-click resets, "Dingetje" popup while dragging. Notch: double-click to type; Shift snaps, Ctrl 10x slower, Alt goes outside the range; drag a modifier node onto a property to automate it.
- https://resolume.com/support/en/parameters
- https://manual.notch.one/2026.1/en/docs/reference/user-interface/properties/

**VJ-9. Learn / shortcut mode tints the whole UI; every mappable control is visibly mappable, colour-coded by protocol.** (V)
MadMapper Learn mode: "Blue for keyboard, Green for MIDI, Yellow for OSC, Purple for DMX"; Control List via Cmd+L. Resolume Ctrl-Shift-K: "the interface will now turn partially blue... Everything blue can have a shortcut assigned". Mapping is a mode, not a dialog; the assigned key is written on the control.
- https://docs.madmapper.com/madmapper/6/11.-live-performance-and-control
- https://resolume.com/support/en/keyboard-shortcuts

**VJ-10. Mapping is a separate mode with two canvases: input (what part of the comp) and output (where on the projector).** (V/S)
MadMapper: Input View for texture coordinates, Output Preview for perspective, both or one at a time; media left, surfaces centre, projectors right; Show Surface Names; corner pin, quad mesh warp with bezier, per-group perspective. Resolume Advanced Output: Input Selection vs Output Transformation, screens/slices list, edge blending, kept out of the performance UI. Geometry never shares screen space with performance controls.
- https://madmapper.com/files/01-Introduction%20to%20the%20User%20Interface.pdf (image-based PDF; panel names from indexed summary)
- https://madmapper.com/madmapper/faq
- https://resolume.com/support/en/advanced-output
- https://whatmakeart.com/video/projection-mapping/madmapper-basics/

**VJ-11. Cue values that differ from the live value are coloured orange; cue transitions are per-parameter.** (S)
MadMapper Scenes and Cues: "The opacity appears in orange color, which means that its value in the cue is different than the current parameter value"; cues can fade opacity but snap RGB. "Armed but not live" has a colour.
- https://madmapper.com/files/06-Scenes%20and%20Cues.pdf
- https://madmapper.com/madmapper/faq

**VJ-12. Explicit ON-AIR / freeze / lock toggles on the top toolbar plus an always-visible FPS meter.** (V)
Smode toolbar: Enable/Disable Video Outputs, Freeze Output, ON-AIR, User Interface Lock, FPS meter. Millumin: "Freeze outputs", "Disable workspace" to lock it (also lowers render rate), "Display FPS". Operator states intent in one click; health is on the toolbar.
- https://doc.smode.io/reference/ui/toolbar/index.html
- https://help.millumin.com/v4/general/tips/

**VJ-bonus. Drawer-adjacent conveniences.** (V)
VDMX Preview Window pointed at a layer reveals that layer's opacity slider and blend button; VDMX layers are three inspectors (source, fx chain, composition) that can pop out. Synesthesia expands preview and sidebar while editing and hides them while performing; D/R/P/L hotkeys on the hovered control (default, random, preset, lock).
- https://vdmx.vidvox.net/tutorials/preview-windows
- https://docs.vidvox.net/vdmx/
- https://synesthesia.live/docs/manual/control_hotkeys.html
- https://vjun.io/vdmo/synesthesia-120-24bm

### Anti-patterns

- **Monitors crammed into a corner by default.** Resolume stock layout: "the composition and preview monitors are crammed in the bottom-left corner. You can barely see what you're outputting". https://vjacademy.info/resolume-composition-layout
- **Everything is a free-floating window (VDMX).** The interface is whatever pile of windows you left; snapping and window groups exist because the default has no structure. https://docs.vidvox.net/vdmx/vdmx_inspectors.html
- **Master fader with no state colour; blackout as "fader at zero" or an unmapped spacebar.** https://resolume.com/support/en/keyboard-shortcuts
- **Blackout hidden three levels deep** (Millumin Window > Monitor > Masters). Right feature, wrong address. https://help.millumin.com/docs/connect/monitor/
- **Node graph or element tree as the primary performance surface** (Notch needs minimap, Ctrl+Space search and Ctrl+F to navigate; Smode saves workspaces per project because no arrangement fits both authoring and running). https://manual.notch.one/2026.1/en/docs/reference/user-interface/nodegraph/ , https://doc.smode.io/userGuide/tutorialsAndHow-Tos/creatingAndCompositing/discoverUI/workspaces/index.html
- **No crossfade between scenes**, so "fade to black, switch, fade up" is official advice (Synesthesia). https://synesthesia.live/docs/faq/

Not verified (N): HeavyM Output Setup blackout/solo per screen and the Overview page; MadMapper panel names beyond the indexed summary; Notch properties details beyond the snippet.

### What we take

- Two monitors, PROGRAM big, PREVIEW small; selecting previews, GO fires. (VJ-1, VJ-6)
- Master cluster top-left on both devices: Blackout, Master (red under 100%), Freeze. Blackout is a hard state with its own visual, not a fader position. (VJ-2, VJ-4, VJ-12)
- Layer strip with X/B/S, opacity fader, blend; same shape per row. (VJ-3)
- Status vocabulary: on-air = yellow fill with dot; selected = neutral outline; pending diff = orange. (VJ-4, VJ-11)
- Program strip = Millumin columns; SPACE = next; edit mode is a separate, locked-by-default mode. (VJ-5)
- 8-slot dashboard of promoted parameters, the same 8 the phone sliders bind to. (VJ-7)
- One slider widget with drag / type / math / reset / modifiers; D/R/L hotkeys. (VJ-8, VJ-bonus)
- Learn mode tints mappable controls by protocol. (VJ-9)
- Mapping is a mode with a lock; input in the drawer, output handles on the monitor. (VJ-10)
- Every program step has a transition; no blackout-as-transition. (anti-pattern 6)

---

## 2. DAWs and synths (Bitwig, Ableton Live, Vital, Serum 2, FL Patcher, Vezer)

### Patterns

**DAW-1. Modulation depth as a coloured ring on the target control, set by dragging the ring.** (V)
Bitwig: arm a modulator's routing button, "click the target parameter and drag its value to set maximum modulation depth"; potential targets are shaded, assigned destinations bright; blue vs green rings for mono vs per-voice. Serum 2: "A ring shows up around the knob; pull that ring to decide how far the modulation reaches." Amount, polarity and target in one glance; removal is pulling the ring to zero.
- https://www.bitwig.com/userguide/latest/the_unified_modulation_system/
- https://monosounds.studio/serum-2-modulation-guide/

**DAW-2. Drag a source handle onto a control, with live "can I drop here" highlighting and audition-on-hover.** (V)
Vital: every source has a coloured drag handle; while dragging, modulatable parameters light up; "audition the modulation by hovering over the target while playing"; scroll wheel adjusts depth before assigning.
- https://davidmvogel.com/docs/Vital/UserGuide/Modulation
- https://www.databroth.com/blog/vital-review

**DAW-3. The matrix is a secondary, complete view of routings made visually; one row per routing.** (V)
Serum 2 Matrix tab: source, amount, destination, bipolar/unipolar, curve, aux scaling, bypass, drag-reorder. Bitwig Inspector: "modulation sources" and "modulation destinations" tabs; right-click a knob to see/remove sources. Knob shows local truth, table shows global truth.
- https://www.musicradar.com/music-tech/plugins/a-copy-of-serum-might-be-the-smartest-investment-any-budding-producer-makes-xfer-serum-2-review
- https://www.bitwig.com/userguide/latest/the_unified_modulation_system/

**DAW-4. A fixed page of eight remote controls in a stable order, following whatever is selected.** (V)
Bitwig Remote Controls: eight assignments "always colored in rainbow order... to help you mentally connect each particular hardware control with its ever-changing software assignment"; pages per preset, device, modulator; 5.1 shows device pages in the mixer track view. Muscle memory stays constant, only labels change.
- https://www.bitwig.com/userguide/latest/midi_controllers/
- https://www.soundonsound.com/reviews/bitwig-studio-5-1

**DAW-5. Macro Map Mode: click Map, click a parameter, click a macro; edit Min/Max in a mapping list; inversion = Min above Max.** (V)
Ableton Live 12 Racks: coloured overlay on every mappable parameter; Mapping Browser opens for range; up to 16 macros, 8 shown by default; custom names, colours, info text.
- https://www.ableton.com/en/manual/instrument-drum-and-effect-racks/

**DAW-6. Macro Variations: named snapshots of the macro page plus a Rand button with per-knob exclusion.** (V)
Ableton Live 12: "go to look X" is one button; randomise with exclusions is a cheap idea generator.
- https://www.ableton.com/en/manual/instrument-drum-and-effect-racks/

**DAW-7. Clip state encoded in the cell: pie progress for loops, progress bar for one-shots, coloured launch button for scenes with their own tempo, lit "Back to Arrangement" when overridden.** (V)
Ableton Session View; Bitwig shows a vertical playhead line through the active clip.
- https://www.ableton.com/en/manual/session-view/
- https://www.bitwig.com/userguide/latest/triggering_launcher_clips_0/

**DAW-8. Follow Actions / Next Actions per clip with chance and a global kill switch.** (V for Live, S for Bitwig)
Live: Stop, Play Again, Previous, Next, First, Last, Any, Other, Jump; Chance A/B; Linked/Unlinked; "Enable Follow Actions Globally". Bitwig Next Action: enable, time, Stop / Return to Arrangement / Return to Last Clip / Play Next / Round-robin.
- https://www.ableton.com/en/manual/launching-clips/
- https://www.bitwig.com/userguide/latest/acquiring_and_working_with_launcher_clips/

**DAW-9. Session grid and linear timeline coexist side by side in the same tracks.** (V)
Bitwig: "The Launcher and Arrange Timeline can be side by side in the same tracks"; scene columns resize. Live: "a track can be playing either a Session clip or an Arrangement clip, but never both." "Now" and "tonight" are different mental models.
- https://www.musicradar.com/reviews/bitwig-studio-5-review
- https://www.bitwig.com/userguide/latest/the_clip_launcher/
- https://www.ableton.com/en/manual/live-concepts/

**DAW-10. LFO shape editor: double-click to add points, drag closed midpoints for tension, X/Y grid snap, brush for steps.** (V)
Vital open vs closed points; X grid = time, Y grid = amplitude; modifier for brush; wheel sets grid. Serum: double-click add/remove, shift-click steps, alt-drag snap.
- https://blog.landr.com/vital-synth/
- https://www.databroth.com/blog/vital-review
- https://www.productionmusiclive.com/blogs/news/10-quick-serum-tips

**DAW-11. Progressive disclosure: unused panels dim, modulators appear as you consume slots, extended editors on click.** (V)
Vital "displays information as needed with unused panels being dim"; Bitwig shows three empty slots, each opens an extended view; MSEG panels resizable in 5.
- https://www.databroth.com/blog/vital-review
- https://polarity.me/posts/bitwig-guides/2022-04-12-the-modulation-system-bitwig-modulator-guide/
- https://www.soundonsound.com/reviews/bitwig-studio-5-1

**DAW-12. Node graph with typed, colour-coded wires, drop-on-node popup for parameter targets, activity animation toggle, auto-arrange.** (V)
FL Studio Patcher: inputs left, outputs right; "Audio (yellow)", "Parameters (red)", "Events (green)"; drop on plugin centre opens a list of compatible targets; View toggles activity animation and per-module CPU.
- https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/plugins/Patcher.htm

**DAW-13. Show-control timeline: typed tracks, markers / stop cues / jumps on the timeline, compositions in a queue, record incoming data.** (V/S)
Vezer (Imimot): MIDI, OSC, DMX/Art-Net, audio tracks; "keyframes, curves, markers, and track lanes"; "Composition Queue"; "Record incoming DMX data"; "Audio to keyframes"; remote-controllable transport.
- https://imimot.com/vezer
- https://www.synthtopia.com/content/2016/02/11/vezer-a-midioscdmx-timeline-control-app-for-multimedia-artists/
- https://www.linkedin.com/company/imimot (city claim from snippet only, N)

### Anti-patterns

- **Everything at once on a laptop.** Live 12 stacked views "can feel a little on the clutered side with everything displayed at once, particularly on a laptop screen." https://www.musicradar.com/reviews/ableton-live-12-suite-review
- **Cramped sub-panels with too many controls at fixed size.** Serum 2 effects rack "can feel a little cramped"; Bitwig 5.1 MSEG parameters "overwhelming". https://www.musicradar.com/music-tech/plugins/a-copy-of-serum-might-be-the-smartest-investment-any-budding-producer-makes-xfer-serum-2-review , https://www.soundonsound.com/reviews/bitwig-studio-5-1
- **Free-form node canvases with no cable management**, mouse deadzones, align tools that make it messier. https://forum.image-line.com/viewtopic.php?t=256078
- **Destructive actions without undo/recovery in a live tool** ("accidentally deleted a bunch of surface controls", presets that cannot be overwritten). https://forum.image-line.com/viewtopic.php?t=256078
- **Stacking power on power until the tool is no longer approachable**; per-clip automation becomes invisible state, hence Live's global Follow Actions kill switch. https://www.musicradar.com/reviews/bitwig-studio-5-review , https://www.soundonsound.com/reviews/bitwig-studio-5-1 , https://www.ableton.com/en/manual/launching-clips/

Not verified (N): Bitwig Next Action option list (search summary); Serum 2 LFO editor specifics beyond tips articles.

### What we take

- Modulation drawn on the target control in the source's hue; depth dragged on the control; unmodulated controls draw nothing. (DAW-1)
- Source chips you drag onto controls; eligible targets brighten, everything else dims. (DAW-2)
- Matrix as a secondary drawer panel, one row per routing, never the entry point. (DAW-3)
- Eight macro slots in a fixed order shared by laptop dashboard and phone. We keep the fixed order, not the rainbow (see brief, rejected list). (DAW-4)
- Map mode with overlay; Min/Max range; named macro variations plus Rand with exclusions. (DAW-5, DAW-6)
- Program cells carry their own state (pie / bar / follow chip); "Back to program" lights when overridden. (DAW-7)
- Per-step follow actions with chance; one global follow toggle in the top bar from day one. (DAW-8)
- Program strip ("now") and evening timeline ("tonight") as two rows, never one widget. (DAW-9, DAW-13)
- LFO editor with open/closed points and grid snap. (DAW-10)
- Progressive disclosure; inactive at 40% opacity. (DAW-11)
- Node graph: typed ports, wire hue = signal family, drop-on-node popup, auto-arrange default, every delete undoable. (DAW-12, anti-patterns 3 and 4)

---

## 3. Pro creative tools (DaVinci Resolve, Blender, Nuke, Unreal, TouchDesigner, Figma)

### Patterns

**PRO-1. One task per page, persistent page switcher at the bottom.** (V)
Resolve's 7 pages (Media, Cut, Edit, Fusion, Color, Fairlight, Deliver) each rearrange viewer, panels and tools; nothing from other jobs is on screen.
- https://www.blackmagicdesign.com/products/davinciresolve/
- https://2pop.calarts.edu/technicalsupport/davinci-resolve-interface/

**PRO-2. Inside a page, a toolbar of panel toggles; the viewer grows into whatever you hide; escalating focus modes.** (V)
Resolve Color page: show/hide Gallery, LUTs, Media Pool, Clips, Nodes, Effects, Lightbox, Scopes; Enhanced Viewer (Alt+F), Full Screen Viewer (Shift+F), Cinema Viewer (Cmd+F / P).
- https://larryjordan.com/articles/get-started-with-the-color-page-in-davinci-resolve/
- https://benonistudio.com/davinci-resolve-all-full-screen-playback-options/

**PRO-3. Non-overlapping, non-blocking, non-modal.** (V, mirror)
Blender HIG: no overlapping windows; Screens > Areas > Regions; tools never block; no modal dialogs waiting for input; "Select then Operate"; "Operate then Settings"; Properties separate from Tools.
- https://julianeisel.github.io/wiki.blender.org-dump/wiki/Human_Interface_Guidelines/Paradigms.html

**PRO-4. Workspaces as tabs, each a saved layout.** (V)
Blender 2.80 workspaces; Nuke's six default workspaces on Shift+F1..F6, savable to .nuke.
- https://julianeisel.github.io/wiki.blender.org-dump/wiki/Reference/Release_Notes/2.80/UI.html
- https://learn.foundry.com/nuke/content/getting_started/using_interface/nuke_studio_environments.html

**PRO-5. Single-column property layouts, sub-panels for the rare, headings to kill repetition.** (V)
Blender 2.80 Properties; HIG: most-used first, lesser-used below or collapsed; group under headings; enums over 2 or 3 items become dropdowns; pie menus max 8; never carry meaning by spatial arrangement.
- https://julianeisel.github.io/wiki.blender.org-dump/wiki/Reference/Release_Notes/2.80/UI.html
- https://julianeisel.github.io/wiki.blender.org-dump/wiki/Human_Interface_Guidelines/Layouts.html

**PRO-6. Selection drives the properties panel; the panel has a lock/pin, search, favourites, "differs from default" with reset.** (V/S)
UE5 Details: filter by component, search-as-you-type, lock to one object, Favorites float to top, differs-from-default indicator, Section Bar. TouchDesigner parameter dialog follows the selected OP, toggled with `p`, Network/Pane Sticky, multi-select edits all. Blender hides tabs that do not apply. Figma right sidebar shows file-level with nothing selected, layer properties with a selection.
- https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-editor-interface
- https://dev.epicgames.com/documentation/en-us/unreal-engine/level-editor-details-panel-in-unreal-engine
- https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-5.0-release-notes?application_version=5.0
- https://docs.derivative.ca/Parameter_Dialog
- https://docs.blender.org/manual/en/2.81/editors/properties_editor.html (S)
- https://help.figma.com/hc/en-us/articles/360039832014-Design-prototype-and-view-code-in-the-right-sidebar

**PRO-7. Cap how many property panels can be open.** (V)
Nuke Properties bin max-panels defaults to 10; working compositors set 2 because more "is never useful" and invites editing the wrong node; lock the bin, clear all, float/dock per panel.
- https://learn.foundry.com/nuke/content/getting_started/using_interface/properties_panels.html
- https://conradolson.com/four-nuke-preferences-i-always-change-immediately

**PRO-8. Drawers instead of docked panels for secondary browsers.** (V)
UE5 Content Drawer (Ctrl+Space) "automatically minimizes when it loses focus"; panels collapse into sidebar tabs. Figma UI3 Minimize UI (Cmd+Shift+\) collapses side panels; the right panel expands only while something is selected.
- https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-editor-interface
- https://help.figma.com/hc/en-us/articles/41414918021271-Hide-or-minimize-the-UI

**PRO-9. Fixed, resizable panels beat auto-hiding floating panels.** (V)
Figma UI3 beta floating hover panels "cramped the canvas" and "slowed people down"; reverted to fixed resizable panels; properties reordered so component controls come first and all layout values live in one block.
- https://www.figma.com/blog/our-approach-to-designing-ui3/
- https://www.figma.com/blog/making-the-move-to-ui3-a-guide-to-figmas-next-chapter/

**PRO-10. Visible text labels plus tooltips; never icon-only for anything non-obvious.** (V)
Figma UI3 moved away from "minimalist iterations that compromised accessibility". Blender writing style: Title Case, no abbreviations, no "Enable/Use/Is" prefixes on checkboxes, "..." for popups, tooltips 2 to 3 lines starting with a verb, positive state only; never reuse an icon; icon colour is semantic (green add, red remove, purple edit).
- https://www.figma.com/blog/our-approach-to-designing-ui3/
- https://julianeisel.github.io/wiki.blender.org-dump/wiki/Human_Interface_Guidelines/Writing_Style.html
- https://julianeisel.github.io/wiki.blender.org-dump/wiki/Human_Interface_Guidelines/Tooltips.html
- https://julianeisel.github.io/wiki.blender.org-dump/wiki/Human_Interface_Guidelines/Icons.html

**PRO-11. Colour-code by data type, not decoration; breadcrumb and minimap for graphs.** (V)
TouchDesigner: one node colour per operator family, darker for generators, lighter for filters; Tab-key OP Create dialog by family; path breadcrumb; `o` overview. Nuke: auto-colour by function, channel bars, Dot nodes, backdrops, navigation map.
- https://docs.derivative.ca/First_Things_to_Know_about_TouchDesigner
- https://docs.derivative.ca/Operator_Family
- https://docs.derivative.ca/Network_Editor
- https://learn.foundry.com/nuke/content/getting_started/using_interface/working_nodes.html
- https://learn.foundry.com/nuke/12.1/content/getting_started/using_interface/navigating_node_graph.html

**PRO-12. Dark-theme numbers these apps converge on.** (V/S)
Material: base #121212; text at 87 / 60 / 38% white; elevation as 0 to 16% white overlay; 15.8:1 white-on-surface so raised surfaces still hit 4.5:1; desaturate accents. WCAG AA 4.5:1 body, 3:1 large text and UI parts; halation makes light-on-dark look thicker, avoid pure white and thin weights. Blender's base widget unit is 20 px times UI scale. UE5 5.0 went darker with compact icons; TouchDesigner 2022 bumped its UI font size because the old size was hard to read; Figma's UI font is reported by users as about 11 px Inter (community claim, N).
- https://codelabs.developers.google.com/codelabs/design-material-darktheme
- https://blog.prototypr.io/how-to-design-a-dark-theme-for-your-android-app-3daeb264637
- https://www.colorcontrast.org/blog/dark-mode-contrast-accessibility-guide/
- https://developer.blender.org/docs/features/interface/preferences_and_defaults/ (S)
- https://julianeisel.github.io/wiki.blender.org-dump/wiki/Source/Interface/Preferences_and_Defaults.html
- https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-5.0-release-notes?application_version=5.0
- https://interactiveimmersive.io/blog/touchdesigner-lessons/touchdesigner-2022-release/
- https://forum.figma.com/suggest-a-feature-11/change-interface-scale-or-just-figma-s-ui-font-scale-36463

### Anti-patterns

- **Hover-revealed / auto-hiding floating panels.** Figma UI3 beta reverted; still the top forum complaint. https://www.figma.com/blog/our-approach-to-designing-ui3/ , https://forum.figma.com/suggest-a-feature-11/ui3-needed-functionality-is-hidden-floating-panels-issues-new-functionality-and-keyboard-shortcuts-31483
- **Unbounded stacks of property panels** (Nuke default 10). https://conradolson.com/four-nuke-preferences-i-always-change-immediately
- **Icon-only controls with no label.** https://www.figma.com/blog/making-the-move-to-ui3-a-guide-to-figmas-next-chapter/ , https://julianeisel.github.io/wiki.blender.org-dump/wiki/Human_Interface_Guidelines/Icons.html
- **Modal dialogs and blocking tools.** https://julianeisel.github.io/wiki.blender.org-dump/wiki/Human_Interface_Guidelines/Paradigms.html
- **Meaning carried by spatial arrangement.** https://julianeisel.github.io/wiki.blender.org-dump/wiki/Human_Interface_Guidelines/Layouts.html
- **"Enable X" checkbox labels, negative-state tooltips, abbreviations.** https://julianeisel.github.io/wiki.blender.org-dump/wiki/Human_Interface_Guidelines/Writing_Style.html
- **Too-dark, too-uniform UI with no elevation cue** (UE5 "UI is too dark" threads). https://forums.unrealengine.com/t/ui-is-too-dark-add-ability-to-lighten-it-up-a-little/255235

Not verified (N): published font sizes or row heights for Resolve, Nuke, UE5, TouchDesigner; Blender default font point size.

### What we take

- One stage layout; heavy tools do not get separate pages but "wide" drawer modes so the preview never disappears (Resolve keeps the viewer on every page). (PRO-1, PRO-2)
- Non-overlapping, non-modal; nothing floats over the output except the optional popped-out chat. (PRO-3, PRO-9)
- Drawer = one panel, selection-driven, pinnable, searchable, differs-from-default dots, favourites strip, max one selection. (PRO-6, PRO-7)
- Single-column property rows, 24 px, headings, sub-panels, dropdowns for enums over 3. (PRO-5)
- Visible labels everywhere; icon+label on the rail; Blender writing rules. (PRO-10)
- Hue per signal family in the graph, breadcrumb and overview. (PRO-11)
- Material dark numbers: #12 base, tonal tiers, 87/60/38 text, desaturated accents, one size step larger than daylight. (PRO-12)

---

## 4. AI agent surfaces (Cursor, VS Code Copilot, Claude Code Desktop, Windsurf, Figma, Notion, Raycast, Photoshop, Linear)

### Patterns

**AI-1. Chat is a secondary pane; the work surface stays primary; lighter tiers exist (inline, quick).** (V)
Cursor Agent sidepane (Cmd+I); VS Code sidebar chat plus inline chat (Ctrl+I) and Quick Chat; Notion Sidebar vs Floating chat modes.
- https://cursor.com/docs/agent/overview
- https://code.visualstudio.com/docs/copilot/chat/copilot-chat
- https://www.notion.com/help/notion-agent

**AI-2. Chat pops out to a detached, always-on-top window.** (V)
ChatGPT macOS companion window (Option+Space); Figma "Pop out Agents panel"; Raycast AI Chat dedicated window.
- https://9to5mac.com/2024/08/06/multitasking-with-chatgpt-on-the-mac-just-got-a-lot-better/
- https://help.figma.com/hc/en-us/articles/37998629035799
- https://manual.raycast.com/ai/chat

**AI-3. Every change is a card with Keep / Undo plus a checkpoint per request; restoring reverts files, not messages.** (V)
VS Code Keep/Undo, changed-files list, pending dot on tabs, snapshot per request; Windsurf Accept/Reject per change and per file, named checkpoints; Cursor checkpoints ("Restoring a checkpoint reverts files only; it does not remove messages").
- https://code.visualstudio.com/docs/copilot/chat/review-code-edits
- https://code.visualstudio.com/docs/copilot/chat/chat-checkpoints
- https://docs.devin.ai/desktop/cascade
- https://cursor.com/docs/agent/overview

**AI-4. Diff-stats badge, not a diff, until you ask.** (V)
Claude Code Desktop: "+12 -1" indicator; click opens diff viewer; Review code button; Manual mode shows Accept/Reject per change.
- https://code.claude.com/docs/en/desktop-quickstart
- https://code.claude.com/docs/en/desktop

**AI-5. Permission modes as a visible selector next to send; the dangerous class always gets a card.** (V)
Claude Code: Auto, Accept edits, Manual, Plan (Cmd+Shift+M). Copilot terminal approval; VS Code `chat.editing.autoAcceptDelay` countdown you stop by hovering. Cowork asks before deleting files.
- https://code.claude.com/docs/en/desktop
- https://code.visualstudio.com/blogs/2025/02/24/introducing-copilot-agent-mode
- https://support.claude.com/en/articles/13364135

**AI-6. Context as chips above the input; implicit context visible and toggleable.** (V)
VS Code #file / #codebase / #terminalSelection, eye toggle for implicit context; Notion page context plus @-mention; Figma canvas selection as implicit context; Raycast attachments scoped per message.
- https://code.visualstudio.com/docs/copilot/chat/copilot-chat
- https://www.notion.com/help/notion-agent
- https://help.figma.com/hc/en-us/articles/37998629035799
- https://manual.raycast.com/ai/chat

**AI-7. Progress lives on the canvas, not only in the chat.** (V)
Figma: animated loading indicator on the canvas per running prompt; click to open steps and result; parallel prompts; Stop in the chat box.
- https://help.figma.com/hc/en-us/articles/37998629035799

**AI-8. Tool calls collapsed into one-line summaries; verbose on demand; typed activity states with a 10-second liveness rule.** (V)
Claude Code Normal vs Verbose; Copilot expandable tool sections; Linear Agent SDK activities (thought, action, elicitation, response, error), first thought within 10 s "or the agent will be shown as unresponsive".
- https://code.claude.com/docs/en/desktop
- https://code.visualstudio.com/blogs/2025/02/24/introducing-copilot-agent-mode
- https://linear.app/developers/agent-best-practices

**AI-9. Generation is non-destructive and comes as variations.** (V)
Photoshop Generative Fill: prompt in the floating Contextual Task Bar at the selection; result on a Generative Layer with mask; three variations, arrow keys, Generate again. Figma First Draft thumbnails plus Make changes.
- https://www.adobe.com/cc-shared/fragments/products/photoshop/generative-fill/personalization/generative-fill-how-tos
- https://helpx.adobe.com/photoshop/desktop/whats-new/whats-new-in-adobe-photoshop-on-desktop.html
- https://help.figma.com/hc/en-us/articles/23955143044247

**AI-10. Steer without stopping; queue follow-ups; Stop is always there.** (V)
Claude Code corrections mid-run and side chat (Cmd+; or /btw); Cursor message queue with drag-reorder; Cursor diff view with Stop.
- https://code.claude.com/docs/en/desktop-quickstart
- https://cursor.com/docs/agent/overview
- https://cursor.com/docs/agent/review

**AI-11. Quick actions as slash commands, presets and one-tap skills.** (V)
VS Code `/`; Claude Code `/` or +; Raycast presets with hotkeys, Quick AI escalates to Chat; Notion one-click skills.
- https://code.visualstudio.com/docs/copilot/chat/copilot-chat
- https://manual.raycast.com/ai/chat
- https://www.raycast.com/changelog/macos/1-72-0

**AI-12. Phone = outcomes and approvals, not the stream.** (V)
Claude Dispatch / Cowork mobile: outcome messages, push when done or needs go-ahead, same conversation on desktop. Cursor 3 cloud agents create demos and screenshots for review.
- https://support.claude.com/en/articles/13947068
- https://code.claude.com/docs/en/desktop
- https://the-decoder.com/new-cursor-3-ditches-the-classic-ide-layout-for-an-agent-first-interface-built-around-parallel-ai-fleets/

### Anti-patterns

- **Applying changes with no review card** (Cursor 2.5.20 regression, "Cursor is unusable"). https://forum.cursor.com/t/agent-mode-no-longer-shows-review-accept-interface-and-applies-file-changes-automatically-after-recent-update/152581
- **Agent-first layout that hides the work** (Cursor 3: "makes you lose any connection to your code"). https://www.infoq.com/news/2026/04/cursor-3-agent-first-interface/ , https://www.openaitoolshub.org/en/blog/cursor-3-agent-first-review
- **Irreversible revert** (Windsurf: "Reverts are currently irreversible"). https://docs.devin.ai/desktop/cascade
- **Silent agent** (Linear: unresponsive after 10 s, stale after 30 min). https://linear.app/developers/agent-best-practices
- **Auto-accept on a timer with no visible countdown; verbose-by-default logs.** https://code.visualstudio.com/docs/copilot/chat/review-code-edits , https://code.claude.com/docs/en/desktop

Not verified (N): Runway Chat Mode UI (only the changelog could be read: https://runway.com/changelog ); ChatGPT Work with Apps apply/diff UI; Linear in-app agent session UI beyond developer docs.

### What we take

- Chat is one drawer panel (360 px), pop-out available, plus an inline prompt bar at the selection (Cmd+I). (AI-1, AI-2, AI-9)
- Every agent edit is a one-line card with +n -n badge, Keep / Undo, a checkpoint per turn; restore keeps the chat; revert is undoable. (AI-3, AI-4, anti-pattern 3)
- Mode selector next to send; destructive class always gets an Allow card. (AI-5)
- Context chips: Program, Selected, Audio, Preview frame; eye toggle. (AI-6)
- Status line under the preview, changes within 1 s, five states from Linear; awaiting-input is the amber state that pings the phone. (AI-7, AI-8, anti-pattern 4)
- Tool calls collapsed by default. (AI-8)
- Variations row for new looks; Stop always visible; corrections queue without stopping. (AI-9, AI-10)
- Slash quick actions with hotkeys. (AI-11)
- Phone agent = notification + Allow/Deny card with before/after thumbnail + variations; never the stream. (AI-12)

---

## 5. Remote and show control (QLab, Companion, Blackout, ETC Eos, Sonos, Tesla, Home Assistant, TouchOSC, grandMA3, Lightkey, Ableton Link)

### Patterns

**REM-1. State-first header: one glance tells you what the rig is doing.** (V)
Blackout Lighting Console (iPad): project name, interface lock, playback, master fader and Link Status in a fixed header above bottom tabs. ETC Eos: blackout button shown at the top of every display when active; grandmaster value shown at the top when below 100%.
- https://docs.blackout-app.com/manual/introduction/main-interface-overview
- https://www.etcconnect.com/WebDocs/Controls/EosFamilyOnlineHelp/en/Content/13_Cue_Playback/01_Playback_Fader_Controls/Blackout_and_Grandmaster.htm

**REM-2. Bottom sheet for system control, then explicit tabs when gestures failed.** (V)
Sonos 2024 swipe-up system sheet; Sonos 2026 restored Home / System / Search tabs and a dedicated volume slider after basic controls became hard to find.
- https://newsroom.sonos.com/254658-sonos-unveils-completely-reimagined-sonos-app-bringing-services-content-and-system-controls-to-one-customizable-home-screen/
- https://www.ecoustics.com/news/sonos-app-update-2026/

**REM-3. Four big quick controls under the status area, user-orderable.** (V)
Tesla app Quick Controls row; long-press to reorder; tappable battery indicator.
- https://www.notateslaapp.com/news/767/how-to-add-a-fifth-quick-control-icon-to-the-tesla-app
- https://www.notateslaapp.com/news/609/tesla-updates-app-again-with-quick-actions-and-improved-visuals

**REM-4. Confirm irreversible actions with copy that states the consequence; exemptions for trusted users.** (V/S)
Tesla frunk "Are you sure? You'll have to close it manually" (forum report, S). Home Assistant `confirmation: {title, text, confirm_text, dismiss_text, exemptions}` on tap / hold / double_tap; design discussion compared it to guarded cockpit switches.
- https://teslamotorsclub.com/tmc/threads/accidental-frunk-openings-with-iphone-ios16-widget.286640/ (S)
- https://www.home-assistant.io/dashboards/actions/
- https://github.com/home-assistant/frontend/discussions/8905

**REM-5. Two-stage panic: first press soft, second press hard, shortcut cannot be remapped.** (V)
QLab: single Escape = panic (fade over Panic duration), double Escape = hard stop, "This is a safety measure."
- https://qlab.app/docs/v5/fundamentals/workspace-settings/

**REM-6. Double-trigger protection with visible feedback on the big button.** (V)
QLab GO: minimum time between GOs; red border after each GO; ignored GO flashes red around the button.
- https://qlab.app/docs/v5/fundamentals/workspace-settings/

**REM-7. Operator resizes the big button and the on-deck area.** (V)
QLab Remote Resize Controls mode; GO, standby, notes, reset / pause / resume / panic at the bottom.
- https://apps.apple.com/us/app/qlab-remote/id642520727
- https://qlab.app/docs/v5/networking/qlab-remote/

**REM-8. Read-only / locked mode as a first-class state that still shows status.** (V/S)
QLab Remote Read-Only Mode; Lightkey "Requires unlocked app" per cue and Live-view-only when locked (S); Blackout Interface Lock; TouchOSC Mk1 double-tap to switch pages.
- https://qlab.app/docs/v5/networking/qlab-remote/
- https://lightkeyapp.com/en/releasenotes (S)
- https://docs.blackout-app.com/manual/introduction/main-interface-overview
- https://hexler.net/touchosc-mk1/manual/configuration-options

**REM-9. Button colour reflects live device state, not the last press.** (V)
Companion feedbacks stack on the base style; press/release separate; duration groups for long-press; steps replace latch.
- https://companion.free/user-guide/v4.1/config/buttons/feedbacks/
- https://companion.free/user-guide/v4.1/config/buttons/actions/
- https://companion.free/user-guide/v4.1/config/buttons/steps/

**REM-10. Bookmarkable browser grid, not the primary surface.** (V)
Companion Web Buttons store options in URL parameters; Emulator viewable from multiple locations.
- https://companion.free/user-guide/v4.1/sidebar/web_buttons/
- https://companion.free/user-guide/v4.2/interactive-buttons/emulator/

**REM-11. Show a peer count on the sync control.** (S)
Ableton Link button shows the count of peers; Note shows "Connected to x peer" and opt-in join/leave notifications.
- https://help.ableton.com/hc/en-us/articles/209072789-Enabling-Link-in-Live (S)
- https://help.ableton.com/hc/en-us/articles/5807502991004-Using-Link-in-Note (S)

**REM-12. Heartbeat plus discovery; the remote shows the same UI as the host.** (V)
TouchOSC /ping at an interval, Zeroconf discovery with spinner and host list, no send if host not found. grandMA3 Web Remote serves screen 1 at `http://<ip>:8080`, 1 to 5 connections, command line background colour shows link state.
- https://hexler.net/touchosc-mk1/manual/configuration-options
- https://hexler.net/touchosc/manual/connections-osc
- https://hexler.net/touchosc-mk1/manual/configuration-connections-osc
- https://help.malighting.com/grandMA3/2.2/HTML/network_webremote.html

**Size baseline.** (V/S) Apple HIG 44x44 pt; Material 48dp; WCAG 2.5.8 minimum 24 CSS px with non-overlapping 24 px circles.
- https://developer.apple.com/design/human-interface-guidelines/buttons
- https://developer.apple.com/forums/thread/739201
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

### Anti-patterns

- **Hidden gesture as the only route to system controls** (Sonos 2024, reverted 2026). https://www.ecoustics.com/news/sonos-app-update-2026/
- **Buttons that mix "state" and "action" labels** (Tesla relabeled to "OPEN Frunk"). https://teslamotorsclub.com/tmc/threads/the-ui-for-the-tesla-app-is-inconsistent-and-confusing.257830/ (S)
- **Destructive action reachable from a widget / notification with no confirmation.** https://teslamotorsclub.com/tmc/threads/accidental-frunk-openings-with-iphone-ios16-widget.286640/
- **"Connection lost. Reconnecting..." toast that lies or never resolves; lag that grows; disconnect on screen sleep.** https://github.com/home-assistant/frontend/issues/8893 , https://community.home-assistant.io/t/companion-app-frequently-says-connection-lost-reconnecting/957497 , https://forum.malighting.com/forum/thread/6281-webremote-has-increasing-amounts-of-lag-and-occasionally-crashes-system/
- **Silently failing into a reduced mode** (QLab Remote drops to Read-Only offline; GO does nothing). https://groups.google.com/g/qlab/c/62TctDnjQYc

Not verified (N): Luminair blackout behaviour and dark-mode specifics ( https://apps.apple.com/us/app/luminair/id920440588 ). Resolume has no native phone remote; docs recommend TouchOSC over OSC ( https://resolume.com/support/en/osc ) and a preview stream needs NDI routing ( https://resolume.com/forum/viewtopic.php?t=19901 ). Lightkey has no iOS remote app, OSC only ( https://www.lightkeyapp.com/en/help ).

### What we take

- Fixed status header with output state, master, peers, frame age, agent state; identical content and order on laptop top bar and phone header. (REM-1, REM-11, REM-12)
- Visible tabs and buttons, never a hidden gesture as the only route. (REM-2)
- One hero button plus a 2x2 quick grid; action labels, not state labels. (REM-3, anti-pattern 2)
- Blackout = press-and-hold with a filling ring; second press while black = hard cut; restore = plain tap; re-trigger lockout with red flash. Escape / double-Escape on the laptop, not remappable. (REM-4, REM-5, REM-6)
- Restart = hold, then a sheet that states the consequence. (REM-4)
- Button state only from engine feedback; stale age shown; auto-reconnect; degraded modes announced in the header. (REM-9, anti-patterns 4 and 5)
- Lock state that still shows status and preview; swipe to unlock. (REM-8)
- Drawer panel, width and collapsed state in the URL; a phone-shaped variant on a bookmark. (REM-10)
- Never expose blackout via widget, notification action or lock screen. (anti-pattern 3)

---

## 6. Platform guidelines (Apple HIG, WCAG 2.2, Material, NN/g, Blender HIG, FabFilter, TouchDesigner, Bitwig)

### Patterns

**GL-1. Text contrast 4.5:1 minimum, aim 7:1 on custom dark colours; 3:1 for large text.** (V)
- https://developer.apple.com/design/human-interface-guidelines/color
- https://developer.apple.com/help/app-store-connect/manage-app-accessibility/sufficient-contrast-evaluation-criteria/
- https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html

**GL-2. Non-text contrast: control boundaries, state changes, slider tracks, focus rings need 3:1.** (V)
- https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html

**GL-3. Never pure black, never pure white; base around #121212; text at 87 / 60 / 38%.** (V)
Material: "#FFFFFF... would visually 'vibrate' against our dark backgrounds". NN/g: "Thin fonts can be easily 'swallowed up' by a dark background."
- https://codelabs.developers.google.com/codelabs/design-material-darktheme
- https://m2.material.io/design/color/dark-theme.html
- https://www.nngroup.com/articles/dark-mode-users-issues/

**GL-4. Elevation by tone, not shadow; 4 to 5 discrete tiers.** (V/N for exact M3 tones)
M3 surfaceContainerLowest to Highest; M2 overlay 4 to 16% white; Apple base vs elevated background sets.
- https://m3.material.io/styles/elevation
- https://codelabs.developers.google.com/codelabs/design-material-darktheme
- https://developer.apple.com/videos/play/wwdc2019/808/

**GL-5. Desaturate accents on dark; use the lighter tonal variant for coloured text or lines.** (V)
- https://codelabs.developers.google.com/codelabs/design-material-darktheme
- https://www.nngroup.com/articles/dark-mode-users-issues/

**GL-6. Hit targets 44x44 pt (Apple, WCAG AAA), 48dp with 8dp gaps (Material), 24 px floor (WCAG AA); text at least 11 pt, macOS body 13 pt.** (V)
- https://developer.apple.com/design/tips/
- https://developer.apple.com/design/human-interface-guidelines/accessibility
- https://support.google.com/accessibility/android/answer/7101858
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html
- https://developer.apple.com/design/human-interface-guidelines/typography

**GL-7. Tabular figures on every live number; slashed or dotted zero.** (V)
`font-variant-numeric: tabular-nums` (OpenType tnum); Inter, IBM Plex Sans, Source Sans, Noto Sans ship it. Verified for this brief: Inter documents `tnum` and `zero` (slashed zero) at https://rsms.me/inter/ ; JetBrains Mono's zero "has a dot inside" per https://www.jetbrains.com/lp/mono/ ; Inter, JetBrains Mono and IBM Plex Mono all resolve on the Google Fonts CSS API.
- https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric
- https://loke.dev/blog/css-font-variant-numeric-tabular-nums
- https://rsms.me/inter/
- https://www.jetbrains.com/lp/mono/
- https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap

**GL-8. Knob vs slider vs number field.** (V)
FabFilter: speed-sensitive drag, hover value popup, Shift fine, wheel; numeric entry was a long-standing user ask. KnobSmith / KVR: knobs faster in tight space, sliders readable relative to each other. u-he: "If you can make a knob for it, do it!" No official Ableton or JUCE writing found (N).
- https://www.fabfilter.com/help/pro-q/using/knobs
- https://prod.fabfilter.com/forum/topic/497/interface-design
- https://knobsmithaudio.com/articles/plugin-aesthetics-and-baggage
- https://www.kvraudio.com/forum/viewtopic.php?t=618081&start=15
- https://audionewsroom.net/2008/05/off-the-record-urs-heckmann-u-he.html

**GL-9. Modulation drawn on the target in the source's colour; amount in a dedicated accent; assignable targets highlight, everything else dims while mapping.** (V)
Bitwig: armed button flashes, assigned destinations bright, potential destinations shaded; "The amount of modulation is shown in orange"; blue mono, green poly, cyan live markers.
- https://www.bitwig.com/userguide/latest/the_unified_modulation_system/
- https://www.bitwig.com/learnings/an-introduction-to-modulators-45/
- https://www.audeobox.com/learn/bitwig/modulators-system-guide/

**GL-10. Signal-flow colour: one hue per family; wires inherit it and animate only when data flows; generators darker than filters; references as grey dashed links.** (V)
- https://docs.derivative.ca/Operator
- https://docs.derivative.ca/First_Things_to_Know_about_TouchDesigner
- https://learn.derivative.ca/courses/100-fundamentals/lessons/101-navigating-the-environment/topic/manipulating-operator-wires/

**GL-11. Colour is never the only carrier of meaning; accent only where attention is wanted; no strong hover jumps.** (V)
- https://developer.blender.org/docs/features/interface/human_interface_guidelines/
- https://projects.blender.org/blender/blender-developer-docs

**GL-12. Panel layout: non-overlapping, non-blocking, non-modal; headings; most-used on top; dropdowns for enums over 2 or 3; new panel only when the current one gets overly tall.** (V/S for Apple)
- https://developer.blender.org/docs/features/interface/human_interface_guidelines/paradigms/
- https://projects.blender.org/blender/blender-developer-docs
- https://developer.apple.com/design/human-interface-guidelines/sidebars (S)

### Anti-patterns

- Pure #000 with #FFF text (halation).
- Saturated neon accents on dark (vibrate, fail contrast, look cheap).
- Grey-on-grey secondary text under 4.5:1 "because it is dark mode".
- Shadows as the only elevation cue.
- Thin (300) type anywhere.
- Skeuomorphic knobs with tiny inset labels ("illegible at normal screen distances", KnobSmith).
- Overlapping palettes and modal dialogs over the output.
- Coloured modulation rings on every knob with no hierarchy; colour as the only modulated/static cue.
- Touch buttons under 44 pt or with no gap.
- Proportional digits on live readouts.

Not verified (N): exact M3 Neutral tone per tier; Apple HIG inspector/toolbar body text; official TouchDesigner family hue names; Ableton or JUCE knob writing.

### What we take

- Palette: #121316 ground, three raised tiers by tone, text 87 / 60 / 38, borders at 3:1, accents at Material 200-tone saturation, every pair checked (numbers in the brief). (GL-1 to GL-5)
- Phone targets 48 pt minimum, 8 pt gaps, 12 pt around danger; 44 pt for laptop touch fallbacks. (GL-6)
- Inter for UI, JetBrains Mono for readouts, tnum and zero on. (GL-7)
- Bars in the drawer, knobs only in the matrix; FabFilter drag behaviour everywhere. (GL-8)
- Bitwig mapping choreography; TouchDesigner wire rules; icon or label next to every colour. (GL-9 to GL-11)
- Blender panel rules for the drawer. (GL-12)
