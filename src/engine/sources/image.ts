import { fileUrl } from "../../rpc";
import { MEDIA_ELEMENTS } from "./media";
import type { SourceDef } from "./types";

// Still image (png/jpg/webp). Decoded once, uploaded once, then just handed to the engine.
// It fills the canvas; use the layer transform to fix the aspect or place it.
export const imageSource: SourceDef<"image"> = {
  type: "image",
  key: (layer) => layer.source.path,
  create(gl, layer) {
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));

    const img = new Image();
    img.crossOrigin = "anonymous";
    let disposed = false;
    img.onload = () => {
      if (disposed) return;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      MEDIA_ELEMENTS.set(layer.id, img);
    };
    // a missing file just leaves the 1x1 black texture in place
    img.onerror = () => console.warn("[vjai] image failed to load:", layer.source.path);
    img.src = fileUrl(layer.source.path);

    return {
      update() {
        return tex;
      },
      dispose() {
        disposed = true;
        MEDIA_ELEMENTS.delete(layer.id);
        gl.deleteTexture(tex);
      },
    };
  },
};
