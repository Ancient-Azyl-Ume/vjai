import type { Layer, Source } from "../../doc/schema";
import type { Fbo, Prog } from "../core/gl";

export type SourceType = Source["type"];
export type SourceOf<T extends SourceType> = Extract<Source, { type: T }>;
export type LayerWith<T extends SourceType> = Layer & { source: SourceOf<T> };

// What the engine hands a source every frame.
export type SourceCtx<T extends SourceType = SourceType> = {
  layer: LayerWith<T>;
  source: SourceOf<T>;
  time: number;
  w: number;
  h: number;
  // compile-once program cache: compiles on first use, then activates it
  use(name: string, vs: string, fs: string): Prog;
  // bind an FBO as the render target (sets the viewport too)
  target(f: Fbo): void;
  drawQuad(): void;
  // modulation-aware param read: the value a mod currently drives, else `base`
  param(path: string, base: number): number;
};

export type SourceInstance<T extends SourceType = SourceType> = {
  // returns the texture holding this frame's picture (canvas-sized, y up)
  update(ctx: SourceCtx<T>): WebGLTexture;
  dispose(): void;
};

export type SourceDef<T extends SourceType = SourceType> = {
  type: T;
  // identity of the instance; when it changes the engine disposes and recreates (default: type only)
  key?(layer: LayerWith<T>): string;
  create(gl: WebGL2RenderingContext, layer: LayerWith<T>): SourceInstance<T>;
};
