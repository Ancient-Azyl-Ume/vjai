import { create } from "zustand";
import { getPath, type Doc } from "../../doc/schema";
import { targetBase } from "../../engine/mods/targets";
import { setSetInterceptor, useDoc } from "../../doc/store";

// "Assign" mode: the mods panel arms a mod, then the next parameter the user touches
// anywhere in the app becomes that mod's target.
//
// Instead of asking every panel to opt in, the doc store routes writes through
// captureAssign() while armed: the write is swallowed and its path becomes the target.
// That covers Tweakpane bindings, plain React sliders and the graph alike, including
// the panels that write a whole sub-object (transform, mask) rather than one field.

type AssignState = { armed: string | null };

export const useAssignStore = create<AssignState>(() => ({ armed: null }));

export function armAssign(modId: string | null) {
  useAssignStore.setState({ armed: modId });
  document.body.style.cursor = modId ? "crosshair" : "";
}

// Assign `path` to the armed mod. Returns true when the touch was consumed.
export function assignTarget(path: string): boolean {
  const armed = useAssignStore.getState().armed;
  if (!armed) return false;
  armAssign(null);
  void useDoc.getState().set(`mods.${armed}.target`, path);
  return true;
}

// Paths no mod can drive: the mod rows themselves and the analyser config.
const NOT_TARGETS = /^(mods|audio)\./;

// Assigning by touching a slider means the touch is a drag: keep swallowing that path
// until the pointer comes up, so picking a target never moves the value it picked.
let guarded: string | null = null;
function guard(path: string) {
  guarded = path;
  const release = () => {
    if (!guarded) return;
    guarded = null;
    window.removeEventListener("pointerup", onUp);
    // The swallowed writes left the picked control showing a value the doc never took, but
    // useTweakpane pulls the doc back into its bindings on every doc change - and the assign
    // itself is one. Bumping `revision` here would rebuild the pane and scroll the panel to
    // the top just as the user picked something in it.
  };
  // a tick after the pointer comes up: Tweakpane emits its last change from that handler
  const onUp = () => setTimeout(release, 50);
  window.addEventListener("pointerup", onUp);
  setTimeout(release, 3000);
}

// The numeric parameter a doc write touches, or null when it is not one.
function paramPath(doc: Doc, path: string, value: unknown): string | null {
  if (NOT_TARGETS.test(path)) return null;
  // targetBase, not the raw doc value: an effect param the user never touched is absent
  // from the doc but is still a real, modulatable target.
  if (typeof value === "number") return targetBase(doc, path) !== undefined ? path : null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const cur = getPath(doc, path);
  if (!cur || typeof cur !== "object") return null;
  // sub-object write (LayersPanel sends the whole transform/mask): find the field that moved
  const now = cur as Record<string, unknown>;
  const changed = Object.entries(value as Record<string, unknown>).filter(([k, v]) => typeof v === "number" && v !== now[k]);
  return changed.length === 1 ? `${path}.${changed[0][0]}` : null;
}

// Installed on the doc store: true means "swallowed, do not apply this write".
function captureAssign(doc: Doc, path: string, value: unknown): boolean {
  const armed = useAssignStore.getState().armed;
  if (!armed && !guarded) return false;
  const target = paramPath(doc, path, value);
  if (!target) return false;
  if (target === guarded) return true; // rest of the drag that did the picking
  if (!armed) return false;
  guard(target);
  return assignTarget(target);
}

setSetInterceptor(captureAssign);

export function useAssignTarget() {
  const armed = useAssignStore((s) => s.armed);
  return { armed, arm: armAssign, cancel: () => armAssign(null) };
}
