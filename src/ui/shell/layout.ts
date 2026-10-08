import type { DockviewApi } from "dockview";
import { PANELS, type PanelDef } from "../panels/registry";

// Dockview layout: built from the panel registry the first time, then persisted to
// localStorage on every change and restored on load. Per machine, not part of the show.
const KEY = "vjai:layout";

let api: DockviewApi | undefined;
export const setLayoutApi = (a: DockviewApi | undefined) => (api = a);

const inGroup = (g: PanelDef["defaultPlacement"]["group"]) =>
  PANELS.filter((p) => p.defaultPlacement.group === g).sort((a, b) => a.defaultPlacement.order - b.defaultPlacement.order);

export function buildDefault(a: DockviewApi) {
  const main = inGroup("main"), right = inGroup("right"), bottom = inGroup("bottom");
  const anchor = main[0].id;
  main.forEach((p, i) => a.addPanel({ id: p.id, component: p.id, title: p.title, position: i ? { referencePanel: anchor, direction: "within" } : undefined }));
  right.forEach((p, i) => a.addPanel({ id: p.id, component: p.id, title: p.title, position: i ? { referencePanel: right[0].id, direction: "within" } : { referencePanel: anchor, direction: "right" }, initialWidth: i ? undefined : 420 }));
  bottom.forEach((p, i) => a.addPanel({ id: p.id, component: p.id, title: p.title, position: i ? { referencePanel: bottom[0].id, direction: "within" } : { referencePanel: anchor, direction: "below" }, initialHeight: i ? undefined : 320 }));
  if (bottom[0]) a.getPanel(bottom[0].id)?.api.setActive();
}

export function saveLayout() {
  // an empty layout is never worth storing: it happens while dockview tears down
  if (!api || api.panels.length === 0) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(api.toJSON()));
  } catch {
    // storage full or blocked: the layout is a convenience, never fail the app over it
  }
}

// Returns false when there is nothing usable stored, so the caller builds the default.
export function restoreLayout(a: DockviewApi): boolean {
  const text = localStorage.getItem(KEY);
  if (!text) return false;
  try {
    a.fromJSON(JSON.parse(text));
    return a.panels.length > 0;
  } catch {
    localStorage.removeItem(KEY);
    a.clear();
    return false;
  }
}

export function resetLayout() {
  if (!api) return;
  localStorage.removeItem(KEY);
  api.clear();
  buildDefault(api);
  saveLayout();
}

export const isPanelOpen = (id: string) => !!api?.getPanel(id);

// Where a panel goes when it is (re)opened: next to a visible sibling from its own default
// group, and when that group is empty, back at the group's default edge.
function reopenPlacement(def: PanelDef) {
  const a = api;
  if (!a) return {};
  const sibling = inGroup(def.defaultPlacement.group).find((p) => p.id !== def.id && a.getPanel(p.id));
  if (sibling) return { position: { referencePanel: sibling.id, direction: "within" as const } };
  // The right column docks against the whole grid: relative to the main panel it would only
  // get the height above the bottom group, which is how chat came back at half height.
  if (def.defaultPlacement.group === "right")
    return { position: { direction: "right" as const }, initialWidth: 420 };
  const anchor = inGroup("main").find((p) => a.getPanel(p.id))?.id ?? a.panels[0]?.id;
  if (!anchor) return {};
  if (def.defaultPlacement.group === "bottom")
    return { position: { referencePanel: anchor, direction: "below" as const }, initialHeight: 320 };
  return { position: { referencePanel: anchor, direction: "within" as const } };
}

export function togglePanel(id: string) {
  if (!api) return;
  const open = api.getPanel(id);
  if (open) {
    api.removePanel(open);
  } else {
    const def = PANELS.find((p) => p.id === id);
    if (!def) return;
    api.addPanel({ id, component: id, title: def.title, ...reopenPlacement(def) });
    api.getPanel(id)?.api.setActive();
  }
  saveLayout();
}

export function focusPanel(id: string) {
  const p = api?.getPanel(id);
  if (p) p.api.setActive();
  else togglePanel(id);
}
