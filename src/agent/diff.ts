import { getPath } from "../doc/schema";
import type { Op } from "../doc/store";

// Turns patch ops into one readable line each, e.g.
//   layers.L1.opacity 1 -> 0.4
//   add effect kaleido to L1
// `doc` must be the document as it was BEFORE the ops were applied.

function short(v: unknown): string {
  if (typeof v === "number") return String(Math.round(v * 1000) / 1000);
  if (typeof v === "string") return v;
  if (v === undefined) return "-";
  const t = JSON.stringify(v) ?? String(v);
  return t.length > 44 ? t.slice(0, 43) + "…" : t;
}

function name(v: unknown): string {
  const o = v as { name?: string; type?: string; id?: string } | null;
  return o?.name ?? o?.type ?? o?.id ?? "";
}

export function describeOps(ops: Op[], doc: unknown): string[] {
  return ops.map((op) => {
    const seg = op.path.split(".");
    const parent = seg[seg.length - 2];
    const kind = seg[seg.length - 1];
    if (op.op === "set") {
      return `${op.path}  ${short(getPath(doc, op.path))} -> ${short(op.value)}`;
    }
    if (op.op === "add") {
      const v = op.value as { type?: string; source?: string; target?: string };
      if (op.path === "layers") return `add layer ${name(op.value)}`;
      if (op.path === "mods") return `add mod ${v.source} -> ${v.target}`;
      if (kind === "effects") return `add effect ${v.type} to ${parent}`;
      if (kind === "slices") return `add slice ${name(op.value)} to ${parent}`;
      return `add ${op.path} ${short(op.value)}`;
    }
    const gone = getPath(doc, op.path);
    const label = typeof gone === "object" && gone ? ` (${name(gone)})` : "";
    return `remove ${op.path}${label}`;
  });
}
