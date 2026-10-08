import { useEffect, useState } from "react";
import { emitEvent, onEvent } from "../../rpc";
import { useDoc } from "../../doc/store";
import { useEngineCanvas } from "../hooks/useEngine";
import { useUi } from "./uiStore";
import { IDENTIFY, OUTPUT_ALIVE } from "./session";

// Projector window: one fullscreen canvas rendering one output's slices.
export function OutputView({ outputId }: { outputId: string }) {
  const { ref, engineRef } = useEngineCanvas({ kind: "output", id: outputId }, "window");
  const audioOn = useUi((s) => s.audioOn);
  const doc = useDoc((s) => s.doc);
  const output = doc.outputs.find((o) => o.id === outputId);
  const [identify, setIdentify] = useState(false);

  useEffect(() => {
    document.body.classList.add("output");
    // mic permission was granted to the app already; start straight away so mods run here too
    const t = setInterval(() => {
      const e = engineRef.current;
      // only report "on" once capture actually runs: a denied mic must not read as live
      if (e && !e.audio.running && !audioOn) void e.audio.start().then((ok) => ok && useUi.getState().set({ audioOn: true }));
      if (e?.audio.running) clearInterval(t);
    }, 500);
    return () => clearInterval(t);
  }, [engineRef, audioOn]);

  // tell the main window this projector is alive, and flash on "identify monitors"
  useEffect(() => {
    const beat = setInterval(() => void emitEvent(OUTPUT_ALIVE, { id: outputId }), 1000);
    void emitEvent(OUTPUT_ALIVE, { id: outputId });
    let un = () => {};
    let hide: ReturnType<typeof setTimeout>;
    void onEvent(IDENTIFY, () => { setIdentify(true); clearTimeout(hide); hide = setTimeout(() => setIdentify(false), 4000); }).then((f) => (un = f));
    return () => { clearInterval(beat); clearTimeout(hide); un(); };
  }, [outputId]);

  return (
    <>
      <canvas ref={ref} className="output" />
      {/* panic: the show keeps running underneath, the projector goes black */}
      {doc.blackout && <div className="fixed inset-0 z-10 bg-black" />}
      {identify && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 text-center">
          <div>
            <div className="text-[12vw] leading-none font-bold" style={{ color: "var(--accent)" }}>{output?.monitor ?? "?"}</div>
            <div className="text-[3vw] text-neutral-300">{output?.name ?? outputId}</div>
          </div>
        </div>
      )}
    </>
  );
}
