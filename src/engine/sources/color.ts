import type { SourceDef } from "./types";

// Flat colour: a 1x1 texture, re-uploaded when the rgb changes.
export const colorSource: SourceDef<"color"> = {
  type: "color",
  create(gl) {
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    let last = "";
    return {
      update(ctx) {
        const [r, g, b] = ctx.source.rgb;
        const key = `${r},${g},${b}`;
        if (key !== last) {
          last = key;
          const px = new Uint8Array([r, g, b].map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255)).concat(255));
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
        }
        return tex;
      },
      dispose() {
        gl.deleteTexture(tex);
      },
    };
  },
};
