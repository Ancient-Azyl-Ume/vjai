export type ParamRange = { min: number; max: number; step?: number };

// One effect = one fragment shader plus its numeric params.
// Every key in `defaults` becomes a `uniform float p_<key>` the engine sets each frame
// (modulation-aware). `ranges` drives the Tweakpane sliders in the layer editor.
export type EffectDef<T extends string = string> = {
  type: T;
  label: string;
  defaults: Record<string, number>;
  ranges: Record<string, ParamRange>;
  // GLSL fragment shader; start it with FS_HEAD from core/shaders so u_tex/u_res/u_time/v_uv/o exist.
  fragment: string;
  // When set the engine binds last frame's output of this effect as `uniform sampler2D u_prev`
  // and keeps this frame's output for the next one.
  needsFeedback?: boolean;
};
