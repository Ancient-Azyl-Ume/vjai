import { useEffect, useId, useRef, type RefObject } from "react";
import { Engine, type ViewMode } from "../../engine/core/engine";
import { useDoc } from "../../doc/store";
import { useUi } from "../shell/uiStore";

// One Engine per window. Panels register a 2D canvas as a view of it.
let engine: Engine | undefined;
export function getEngine(): Engine {
  if (!engine) {
    engine = new Engine();
    engine.setDoc(useDoc.getState().doc);
    useDoc.subscribe((s, prev) => { if (s.doc !== prev.doc) engine!.setDoc(s.doc); });
    engine.run();
    useUi.getState().set({ engine });
  }
  return engine;
}

// `fit`: "window" fills the window (projector), else the canvas is scaled to fit `box`
// (default: its parent) while keeping the w:h aspect.
export function useEngineCanvas(mode: ViewMode, fit: { w: number; h: number } | "window", box?: RefObject<HTMLElement | null>) {
  const ref = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine>(null);
  const ready = useDoc((s) => s.ready);
  const id = useId();
  const fitKey = fit === "window" ? "window" : `${fit.w}x${fit.h}`;

  useEffect(() => {
    if (!ref.current || !ready) return;
    const eng = getEngine();
    engineRef.current = eng;
    const c = ref.current;
    const resize = () => {
      if (fit === "window") {
        c.width = Math.round(window.innerWidth * devicePixelRatio);
        c.height = Math.round(window.innerHeight * devicePixelRatio);
      } else {
        const r = (box?.current ?? c.parentElement!).getBoundingClientRect();
        const s = Math.min(r.width / fit.w, r.height / fit.h);
        c.style.width = `${fit.w * s}px`;
        c.style.height = `${fit.h * s}px`;
        c.width = Math.round(fit.w * s * devicePixelRatio);
        c.height = Math.round(fit.h * s * devicePixelRatio);
      }
    };
    resize();
    eng.addView(id, c, mode);
    const ro = new ResizeObserver(resize);
    ro.observe(fit === "window" ? document.body : box?.current ?? c.parentElement!);
    return () => {
      ro.disconnect();
      eng.removeView(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fitKey]);

  useEffect(() => {
    engineRef.current?.setViewMode(id, mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(mode)]);

  return { ref, engineRef };
}
