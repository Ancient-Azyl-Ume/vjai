// Source registry. To add a source: add its variant to SourceSchema in src/doc/schema.ts,
// create src/engine/sources/<name>.ts exporting a SourceDef, and append it here.
// (The layer editor in src/ui/panels/LayersPanel.tsx needs a binding block for its params.)
import type { Layer } from "../../doc/schema";
import type { SourceDef, SourceInstance, SourceType } from "./types";
import { testSource } from "./test";
import { colorSource } from "./color";
import { videoSource } from "./video";
import { imageSource } from "./image";
import { withTransform } from "./transform";

export type { SourceCtx, SourceDef, SourceInstance, SourceType } from "./types";

export const SOURCES: { [K in SourceType]: SourceDef<K> } = {
  test: testSource,
  color: colorSource,
  video: videoSource,
  image: imageSource,
};

// The registry is exact per type; the engine works on the union, hence the one cast here.
const defFor = (layer: Layer) => SOURCES[layer.source.type] as SourceDef<any>;

// Identity of a layer's source instance: type plus whatever the def's `key` adds (e.g. a video path).
export function sourceKey(layer: Layer): string {
  return layer.source.type + ":" + (defFor(layer).key?.(layer) ?? "");
}

// Every source is wrapped in the per-layer transform pass, so what the effect chain sees
// is already positioned/scaled/rotated and carries alpha 0 outside the transformed quad.
export function createSource(gl: WebGL2RenderingContext, layer: Layer): SourceInstance {
  return withTransform(gl, defFor(layer).create(gl, layer));
}
