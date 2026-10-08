import { create } from "zustand";
import type { Engine } from "../../engine/core/engine";

// Local UI state: what is selected and which panel is focused. Never persisted, never in the doc.
type UiState = {
  activePanel: string;
  selectedLayer?: string;
  selectedOutput?: string;
  selectedSlice?: string;
  engine?: Engine;
  audioOn: boolean;
  set: (p: Partial<UiState>) => void;
};

export const useUi = create<UiState>((set) => ({
  activePanel: "preview",
  audioOn: false,
  set: (p) => set(p),
}));
