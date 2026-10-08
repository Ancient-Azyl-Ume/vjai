import type { FC } from "react";
import { PreviewPanel } from "./PreviewPanel";
import { LayersPanel } from "./LayersPanel";
import { MappingPanel } from "./MappingPanel";
import { ModsPanel } from "./ModsPanel";
import { GraphPanel } from "./GraphPanel";
import { ChatPanel } from "./ChatPanel";
import { SettingsPanel } from "./SettingsPanel";
import { MediaPanel } from "./MediaPanel";
import { DeckPanel } from "./DeckPanel";

// Panel registry (append-only). The shell builds the dockview layout from it:
// `main` is the big top-left group, `right` sits beside it, `bottom` is the tab strip below.
// `order` sorts panels inside a group; the first panel of each group anchors the others.
export type PanelDef = {
  id: string;
  title: string;
  component: FC;
  defaultPlacement: { group: "main" | "bottom" | "right"; order: number };
};

export const PANELS: PanelDef[] = [
  { id: "preview", title: "preview", component: PreviewPanel, defaultPlacement: { group: "main", order: 0 } },
  { id: "chat", title: "chat", component: ChatPanel, defaultPlacement: { group: "right", order: 0 } },
  { id: "layers", title: "layers", component: LayersPanel, defaultPlacement: { group: "bottom", order: 0 } },
  { id: "mapping", title: "mapping", component: MappingPanel, defaultPlacement: { group: "bottom", order: 1 } },
  { id: "mods", title: "mods", component: ModsPanel, defaultPlacement: { group: "bottom", order: 2 } },
  { id: "graph", title: "graph", component: GraphPanel, defaultPlacement: { group: "bottom", order: 3 } },
  { id: "media", title: "media", component: MediaPanel, defaultPlacement: { group: "bottom", order: 4 } },
  { id: "deck", title: "deck", component: DeckPanel, defaultPlacement: { group: "bottom", order: 5 } },
  { id: "settings", title: "settings", component: SettingsPanel, defaultPlacement: { group: "bottom", order: 9 } },
];
