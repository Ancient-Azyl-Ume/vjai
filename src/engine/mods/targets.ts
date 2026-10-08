import { getPath, type Doc } from "../../doc/schema";
import { EFFECTS } from "../effects";

// Base value a mod target reads, or undefined when the path is not a numeric param.
//
// Effect params are the one hole in the doc: `EffectSchema.params` is a free record, so a
// param only appears once the user moves its slider and its default lives in the effect
// registry instead. Every other modulatable path is a schema field with a `.default()`, and
// the store parses through DocSchema on every patch, so those values are always in the doc.
export function targetBase(doc: Doc, path: string): number | undefined {
  const v = Number(getPath(doc, path));
  if (Number.isFinite(v)) return v;
  return effectParamDefault(doc, path);
}

const EFFECT_PARAM = /^layers\.([^.]+)\.effects\.([^.]+)\.params\.([^.]+)$/;

function effectParamDefault(doc: Doc, path: string): number | undefined {
  const m = EFFECT_PARAM.exec(path);
  if (!m) return undefined;
  const fx = doc.layers.find((l) => l.id === m[1])?.effects.find((f) => f.id === m[2]);
  const d = fx && EFFECTS[fx.type]?.defaults[m[3]];
  return typeof d === "number" ? d : undefined;
}
