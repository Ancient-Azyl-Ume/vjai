// Shared GLSL: the fullscreen quad vertex shader, the fragment prelude every
// effect/source/output shader starts with, and the engine's own copy/blend passes.

export const VS_QUAD = `#version 300 es
layout(location=0) in vec2 a_uv;
out vec2 v_uv;
void main(){ v_uv = a_uv; gl_Position = vec4(a_uv*2.0-1.0, 0.0, 1.0); }`;

// Every fragment shader gets: v_uv (0..1), o (output), u_tex (input), u_res (canvas px), u_time (s).
export const FS_HEAD = `#version 300 es
precision highp float;
in vec2 v_uv; out vec4 o;
uniform sampler2D u_tex; uniform vec2 u_res; uniform float u_time;`;

export const FS_COPY = FS_HEAD + `void main(){ o = texture(u_tex, v_uv); }`;

// Composites one layer (u_tex) over the stack so far (u_base). u_mode indexes BlendModes.
export const FS_BLEND = FS_HEAD + `
uniform sampler2D u_base; uniform float u_opacity; uniform int u_mode;
void main(){
  vec3 b = texture(u_base, v_uv).rgb; vec4 l = texture(u_tex, v_uv); vec3 s = l.rgb;
  vec3 r;
  if (u_mode == 1) r = b + s;
  else if (u_mode == 2) r = b * s;
  else if (u_mode == 3) r = 1.0 - (1.0 - b) * (1.0 - s);
  else if (u_mode == 4) r = abs(b - s);
  else r = s;
  o = vec4(mix(b, r, u_opacity * l.a), 1.0);
}`;
