export type Fbo = { fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number };

export function compile(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const mk = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s) + "\n" + src);
    }
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link failed");
  return p;
}

export function createTexture(gl: WebGL2RenderingContext, w: number, h: number): WebGLTexture {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

export function createFbo(gl: WebGL2RenderingContext, w: number, h: number): Fbo {
  const tex = createTexture(gl, w, h);
  const fb = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fb, tex, w, h };
}

export function deleteFbo(gl: WebGL2RenderingContext, f: Fbo) {
  gl.deleteFramebuffer(f.fb);
  gl.deleteTexture(f.tex);
}

// Unit quad as a subdivided grid so projective warps interpolate cleanly.
export function createGrid(gl: WebGL2RenderingContext, n: number): { vao: WebGLVertexArrayObject; count: number } {
  const verts: number[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x <= n; x++) {
      verts.push(x / n, (y + 1) / n, x / n, y / n);
    }
    // degenerate triangles between rows
    verts.push(1, y / n, 0, (y + 2) / n);
  }
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return { vao, count: verts.length / 2 };
}

export class Uniforms {
  private cache = new Map<string, WebGLUniformLocation | null>();
  constructor(private gl: WebGL2RenderingContext, private prog: WebGLProgram) {}
  loc(name: string) {
    if (!this.cache.has(name)) this.cache.set(name, this.gl.getUniformLocation(this.prog, name));
    return this.cache.get(name)!;
  }
  f(name: string, v: number) { this.gl.uniform1f(this.loc(name), v); }
  i(name: string, v: number) { this.gl.uniform1i(this.loc(name), v); }
  v2(name: string, a: number, b: number) { this.gl.uniform2f(this.loc(name), a, b); }
  v3(name: string, a: number, b: number, c: number) { this.gl.uniform3f(this.loc(name), a, b, c); }
  v4(name: string, a: number, b: number, c: number, d: number) { this.gl.uniform4f(this.loc(name), a, b, c, d); }
  m3(name: string, m: Float32Array) { this.gl.uniformMatrix3fv(this.loc(name), false, m); }
  tex(name: string, unit: number, t: WebGLTexture) {
    this.gl.activeTexture(this.gl.TEXTURE0 + unit);
    this.gl.bindTexture(this.gl.TEXTURE_2D, t);
    this.gl.uniform1i(this.loc(name), unit);
  }
}

export type Prog = { prog: WebGLProgram; u: Uniforms };

export function createProg(gl: WebGL2RenderingContext, vs: string, fs: string): Prog {
  const prog = compile(gl, vs, fs);
  return { prog, u: new Uniforms(gl, prog) };
}

// Keep an FBO at the requested size, recreating it only when the size changes.
export function ensureFbo(gl: WebGL2RenderingContext, f: Fbo | undefined, w: number, h: number): Fbo {
  if (f && f.w === w && f.h === h) return f;
  if (f) deleteFbo(gl, f);
  return createFbo(gl, w, h);
}
