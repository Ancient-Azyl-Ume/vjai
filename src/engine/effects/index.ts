// Effect registry. To add an effect: create src/engine/effects/<name>.ts exporting an
// EffectDef, then append it to EFFECT_LIST below. The schema enum, the engine programs,
// the layer editor sliders, the mod target list and the agent prompt all follow from this list.
import type { EffectDef } from "./types";
import { zoom } from "./zoom";
import { hue } from "./hue";
import { pixelate } from "./pixelate";
import { threshold } from "./threshold";
import { feedback } from "./feedback";
import { kaleido } from "./kaleido";
import { invert } from "./invert";
import { blur } from "./blur";
import { glow } from "./glow";
import { rgbshift } from "./rgbshift";
import { glitch } from "./glitch";
import { mirror } from "./mirror";
import { levels } from "./levels";
import { chromakey } from "./chromakey";
import { strobe } from "./strobe";
import { edge } from "./edge";
import { tile } from "./tile";
import { noisewarp } from "./noisewarp";
import { colorize } from "./colorize";
import { posterize } from "./posterize";
import { vignette } from "./vignette";

export type { EffectDef, ParamRange } from "./types";

export const EFFECT_LIST = [zoom, hue, pixelate, threshold, feedback, kaleido, invert,
  blur, glow, rgbshift, glitch, mirror, levels, chromakey, strobe, edge, tile, noisewarp, colorize, posterize, vignette];

export type EffectType = (typeof EFFECT_LIST)[number]["type"];
export const EffectTypes = EFFECT_LIST.map((e) => e.type) as [EffectType, ...EffectType[]];
export const EFFECTS = Object.fromEntries(EFFECT_LIST.map((e) => [e.type, e])) as Record<EffectType, EffectDef>;
export const EffectDefaults = Object.fromEntries(EFFECT_LIST.map((e) => [e.type, e.defaults])) as Record<EffectType, Record<string, number>>;
