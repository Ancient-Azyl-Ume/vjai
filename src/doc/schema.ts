import { z } from "zod";
import { EffectTypes } from "../engine/effects";

// The whole app is this one document. UI panels and the chat agent both edit it
// through patch ops; every window renders from it.

export const SourceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("test"), pattern: z.enum(["grid", "bars", "noise", "circles"]).default("grid") }),
  z.object({
    type: z.literal("video"),
    path: z.string(),
    loop: z.boolean().default(true),
    speed: z.number().default(1),
    // playback window in seconds; `out` <= `in` means "to the end of the clip"
    in: z.number().default(0),
    out: z.number().default(0),
    playing: z.boolean().default(true),
    pingpong: z.boolean().default(false),
    muted: z.boolean().default(true),
    volume: z.number().min(0).max(1).default(1),
    // epoch ms the clip (re)started. Every window derives its own playhead from this, so
    // projector windows decode their own copy but stay on the same frame. 0 = free run.
    startedAt: z.number().default(0),
  }),
  z.object({ type: z.literal("image"), path: z.string() }),
  z.object({ type: z.literal("color"), rgb: z.tuple([z.number(), z.number(), z.number()]).default([1, 1, 1]) }),
]);

// Per-layer transform, applied to the source picture before the effect chain.
// x/y are offsets from the canvas centre in canvas widths/heights (0 = centred).
// anchorX/anchorY are the pivot in the layer's own 0..1 space. rotation is degrees.
export const TransformSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  scale: z.number().default(1),
  scaleX: z.number().default(1),
  scaleY: z.number().default(1),
  rotation: z.number().default(0),
  anchorX: z.number().default(0.5),
  anchorY: z.number().default(0.5),
  flipX: z.boolean().default(false),
  flipY: z.boolean().default(false),
});

// Layer mask, applied after the effect chain when the layer is composited.
// luma/alpha read the stack below the layer; rect/ellipse are shapes in canvas 0..1 space.
export const MaskTypes = ["none", "luma", "alpha", "rect", "ellipse"] as const;
export const MaskSchema = z.object({
  type: z.enum(MaskTypes).default("none"),
  invert: z.boolean().default(false),
  x: z.number().default(0.5),
  y: z.number().default(0.5),
  w: z.number().default(0.5),
  h: z.number().default(0.5),
  softness: z.number().default(0.05),
});

// Effect types come from the effect registry (src/engine/effects/index.ts).
export const EffectSchema = z.object({
  id: z.string(),
  type: z.enum(EffectTypes),
  enabled: z.boolean().default(true),
  params: z.record(z.string(), z.number()).prefault({}),
});

export const BlendModes = ["normal", "add", "multiply", "screen", "difference"] as const;
export const LayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean().default(true),
  source: SourceSchema,
  solo: z.boolean().default(false),
  opacity: z.number().min(0).max(1).default(1),
  blend: z.enum(BlendModes).default("normal"),
  transform: TransformSchema.prefault({}),
  mask: MaskSchema.prefault({}),
  effects: z.array(EffectSchema).default([]),
});

export const EdgeSchema = z.object({ width: z.number().default(0), gamma: z.number().default(2.2) });

// Mesh warp on top of the 4-corner homography. `offsets` are displacements in output
// space (0..1, y down), row-major, length cols*rows; all-zero (or a wrong length) means
// "plain corner pin", so docs written before the mesh existed render identically.
export const MeshSchema = z.object({
  enabled: z.boolean().default(false),
  cols: z.number().int().min(2).max(16).default(2),
  rows: z.number().int().min(2).max(16).default(2),
  offsets: z.array(z.tuple([z.number(), z.number()])).default([]),
});

// Polygon mask in slice space (0..1). Fewer than 3 points means no mask.
export const SliceMaskSchema = z.object({
  enabled: z.boolean().default(false),
  softness: z.number().min(0).max(0.5).default(0.02),
  points: z.array(z.tuple([z.number(), z.number()])).default([]),
});

export const SliceSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean().default(true),
  // normalized rect on the composite canvas: x, y, w, h in 0..1
  input: z.tuple([z.number(), z.number(), z.number(), z.number()]).default([0, 0, 1, 1]),
  // normalized output corners TL, TR, BR, BL in 0..1 of the output window
  corners: z.array(z.tuple([z.number(), z.number()])).length(4).default([[0, 0], [1, 0], [1, 1], [0, 1]]),
  blend: z.object({ left: EdgeSchema.prefault({}), right: EdgeSchema.prefault({}), top: EdgeSchema.prefault({}), bottom: EdgeSchema.prefault({}) }).prefault({}),
  blackLevel: z.number().min(0).max(1).default(0),
  mesh: MeshSchema.prefault({}),
  mask: SliceMaskSchema.prefault({}),
});

export const OutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  monitor: z.number().int().default(1),
  slices: z.array(SliceSchema).default([]),
  // calibration helpers: test pattern overrides the content, blackout kills the output
  testPattern: z.boolean().default(false),
  blackout: z.boolean().default(false),
  // exponent applied to the combined edge-blend factor of every slice (1 = off)
  blendGamma: z.number().min(0.2).max(4).default(1),
});

// A macro is a hand-driven 0..1 knob that mods can use as a source (see the graph panel).
export const MacroSchema = z.object({
  id: z.string(),
  name: z.string().default("macro"),
  value: z.number().min(0).max(1).default(0),
});

// Audio signals (src/engine/audio/analyser.ts) plus the generator sources.
export const ModSources = ["rms", "bass", "mid", "high", "kick", "snare", "hat", "beat", "bar", "phase", "lfo", "env", "macro"] as const;
export const LfoShapes = ["sine", "tri", "saw", "square", "rnd", "smooth"] as const;
export const EnvInputs = ["rms", "bass", "mid", "high"] as const;
export const ModSchema = z.object({
  id: z.string(),
  enabled: z.boolean().default(true),
  source: z.enum(ModSources),
  // which macro drives this mod when source is "macro" (an id in doc.macros)
  sourceId: z.string().default(""),
  // dotted doc path of a numeric param, e.g. "layers.<id>.opacity" or "layers.<id>.effects.<id>.params.amount"
  target: z.string(),
  amount: z.number().default(1),
  smooth: z.number().min(0).max(0.99).default(0.6),
  curve: z.number().min(0.1).max(5).default(1),
  rate: z.number().default(1), // lfo only, Hz when free running
  // lfo
  shape: z.enum(LfoShapes).default("sine"),
  sync: z.boolean().default(false), // follow the beat clock instead of rate Hz
  rateBeats: z.number().min(0.0625).max(64).default(1), // cycle length in beats when synced
  offset: z.number().min(0).max(1).default(0), // lfo phase offset
  // envelope follower
  envInput: z.enum(EnvInputs).default("rms"),
  attack: z.number().min(0).max(2000).default(5), // ms
  release: z.number().min(1).max(4000).default(200), // ms
  // output mapping: value = base + amount * (min + (max - min) * x),
  // x being the shaped signal: 0..1 unipolar, -1..1 bipolar
  min: z.number().default(0),
  max: z.number().default(1),
  bipolar: z.boolean().default(false),
  invert: z.boolean().default(false),
  hold: z.boolean().default(false), // sample and hold the value on every beat
});

// Clip deck (src/ui/panels/DeckPanel.tsx): rows are layers, columns are slots 0..7.
// A slot only exists once something is dropped in it; empty cells are drawn from the grid.
export const SlotSchema = z.object({
  id: z.string(),
  clipPath: z.string().nullable().default(null),
  layerId: z.string().default(""),
  col: z.number().int().default(0),
  thumb: z.string().optional(), // small jpeg data url so a saved show still shows pictures
  label: z.string().default(""),
});

export const DeckSchema = z.object({
  id: z.string(),
  name: z.string().default("deck"),
  slots: z.array(SlotSchema).default([]),
});

export const DocSchema = z.object({
  version: z.literal(1).default(1),
  name: z.string().default("untitled"),
  canvas: z.object({ width: z.number().int().default(1920), height: z.number().int().default(1080) }).prefault({}),
  mediaDir: z.string().default(""),
  // panic: every projector output goes black, the show keeps running underneath
  blackout: z.boolean().default(false),
  audio: z.object({
    gain: z.number().default(1),
    kickThreshold: z.number().default(1.6), // onset sensitivity: threshold = mean + this * stddev
    deviceId: z.string().default(""), // input media device id, "" = system default
    bpm: z.number().min(40).max(240).default(120),
    bpmLock: z.boolean().default(false), // true = trust this bpm, ignore the estimator
  }).prefault({}),
  layers: z.array(LayerSchema).default([]),
  outputs: z.array(OutputSchema).default([]),
  mods: z.array(ModSchema).default([]),
  macros: z.array(MacroSchema).default([]),
  decks: z.array(DeckSchema).default([]),
});

export type Doc = z.infer<typeof DocSchema>;
export type Layer = z.infer<typeof LayerSchema>;
export type Effect = z.infer<typeof EffectSchema>;
export type Slice = z.infer<typeof SliceSchema>;
export type Output = z.infer<typeof OutputSchema>;
export type Mod = z.infer<typeof ModSchema>;
export type Macro = z.infer<typeof MacroSchema>;
export type Transform = z.infer<typeof TransformSchema>;
export type Mask = z.infer<typeof MaskSchema>;
export type Mesh = z.infer<typeof MeshSchema>;
export type SliceMask = z.infer<typeof SliceMaskSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type Deck = z.infer<typeof DeckSchema>;
export type Slot = z.infer<typeof SlotSchema>;

export function uid(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 8);
}

export function defaultDoc(): Doc {
  return DocSchema.parse({
    name: "first-light",
    layers: [
      { id: "L1", name: "test grid", source: { type: "test", pattern: "grid" }, effects: [] },
    ],
    outputs: [
      { id: "O1", name: "projector 1", monitor: 1, slices: [{ id: "S1", name: "full" }] },
    ],
    mods: [],
    decks: [{ id: "D1", name: "deck A", slots: [] }],
  });
}

// Read a dotted path (with id-or-index array segments) from the doc.
export function getPath(obj: unknown, path: string): unknown {
  let cur: any = obj;
  for (const seg of path.split(".").filter(Boolean)) {
    if (cur == null) return undefined;
    if (Array.isArray(cur)) {
      const i = Number(seg);
      cur = Number.isInteger(i) ? cur[i] : cur.find((e: any) => e?.id === seg);
    } else cur = cur[seg];
  }
  return cur;
}
