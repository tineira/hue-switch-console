"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { DOUBLE_MS, HOLD_MS, SCENE_COLOURS, SPOTS, clamp } from "@/app/landing/demo-data";

// A room lit by its lights: glows fade in with level, a dark layer covers it when dim or off.
// `hidden` fades the whole room out (the Round before its lights come on); `lamp` draws the
// ceiling strip.
export function Room({
  on,
  level,
  scene,
  still,
  hidden,
  lamp = true,
}: {
  on: boolean;
  level: number;
  scene: string | null;
  still?: boolean;
  hidden?: boolean;
  lamp?: boolean;
}) {
  const L = on ? clamp(level, 0, 100) / 100 : 0;
  const pal = (scene && SCENE_COLOURS[scene]) || ["255 200 140"];
  const glow =
    pal.length === 1
      ? `radial-gradient(120% 90% at 50% -10%, rgb(${pal[0]} / 0.75) 0, rgb(${pal[0]} / 0.32) 38%, rgb(${pal[0]} / 0.08) 70%, transparent 100%)`
      : pal
          .map((c, i) => `radial-gradient(75% 75% at ${SPOTS[i]}, rgb(${c} / 0.8) 0, rgb(${c} / 0.3) 45%, transparent 80%)`)
          .join(", ");
  const strip = pal.length === 1 ? `rgb(${pal[0]})` : `linear-gradient(90deg, ${pal.map((c) => `rgb(${c})`).join(", ")})`;
  const layer = `room-layer pointer-events-none absolute${still ? " room-layer-still" : ""}`;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className={`${layer} inset-0 bg-black`} style={{ opacity: hidden ? 0 : on ? 0.42 * (1 - L) : 0.55 }} />
      <div className={`${layer} inset-0`} style={{ opacity: hidden ? 0 : L * 0.95, background: glow }} />
      {lamp ? (
        <div
          className={`${layer} left-1/2 top-0 -ml-8 h-[5px] w-16 rounded-b-md`}
          style={{
            background: on ? strip : "var(--line)",
            boxShadow: on ? `0 0 ${10 + L * 30}px ${2 + L * 8}px rgb(${pal[0]} / ${0.35 + L * 0.5})` : "none",
          }}
        />
      ) : null}
    </div>
  );
}

// Status LED with the .led timings: heartbeat at rest, fast while holding, one flash per event.
function StatusLed({ pulse, holding }: { pulse: number; holding: boolean }) {
  return (
    <span className={`led ${holding ? "led-fast" : "led-heart"}`} style={{ ["--k" as string]: 12 / 14 } as CSSProperties}>
      {pulse > 0 ? <span key={pulse} className="led-event" /> : null}
    </span>
  );
}

export type SimpleState = { on: boolean; level: number; scene: number; holding: boolean; pulse: number };

export function WallPlate({
  state,
  onClick,
  onDouble,
  onHoldStart,
  onHoldEnd,
}: {
  state: SimpleState;
  onClick: () => void;
  onDouble: () => void;
  onHoldStart: () => void;
  onHoldEnd: () => void;
}) {
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);

  useEffect(() => () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (tapTimer.current) clearTimeout(tapTimer.current);
  }, []);

  function down() {
    held.current = false;
    holdTimer.current = setTimeout(() => {
      held.current = true;
      onHoldStart();
    }, HOLD_MS);
  }
  function up() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (held.current) {
      held.current = false;
      onHoldEnd();
      return;
    }
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      onDouble();
    } else {
      tapTimer.current = setTimeout(() => {
        tapTimer.current = null;
        onClick();
      }, DOUBLE_MS);
    }
  }
  function leave() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (held.current) {
      held.current = false;
      onHoldEnd();
    }
  }

  const screw: CSSProperties = {
    background: "linear-gradient(135deg, #d6d0c6, #bfb8ad)",
    boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 10%)",
  };
  return (
    <div aria-hidden="true" className="flex flex-col items-center gap-3.5">
      <div
        className="relative flex h-40 w-[108px] items-center justify-center rounded-xl"
        style={{
          background: "linear-gradient(160deg, #f7f4ee 0%, #e9e4db 100%)",
          boxShadow:
            "inset 0 1px 0 rgb(255 255 255 / 80%), inset 0 -2px 0 rgb(0 0 0 / 8%), 0 1px 2px rgb(0 0 0 / 30%), 0 16px 32px rgb(0 0 0 / 35%)",
        }}
      >
        <span className="absolute left-1/2 top-3 -ml-1 h-2 w-2 rounded-full" style={screw} />
        <span className="absolute bottom-3 left-1/2 -ml-1 h-2 w-2 rounded-full" style={screw} />
        <div
          className="box-border h-24 w-[60px] rounded-lg p-[3px]"
          style={{ background: "#d9d3c9", boxShadow: "inset 0 1px 3px rgb(0 0 0 / 25%)" }}
        >
          <div
            onPointerDown={down}
            onPointerUp={up}
            onPointerLeave={leave}
            onPointerCancel={leave}
            className="h-full w-full cursor-pointer touch-none select-none rounded-md"
            style={{
              transition: "transform 140ms, background 140ms",
              transform: `perspective(240px) rotateX(${state.on ? -12 : 12}deg)`,
              background: state.on
                ? "linear-gradient(180deg, #fdfbf7 0%, #f3efe8 55%, #ddd7cd 100%)"
                : "linear-gradient(180deg, #ddd7cd 0%, #f3efe8 45%, #fdfbf7 100%)",
              boxShadow: "0 1px 2px rgb(0 0 0 / 25%), inset 0 0 0 1px rgb(255 255 255 / 60%)",
            }}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-line bg-background px-2.5 py-1">
        <StatusLed pulse={state.pulse} holding={state.holding} />
        <span className="font-mono text-[10px] text-muted">status LED</span>
      </div>
    </div>
  );
}

export type Gesture = { gesture: string; action: string; run: () => void };

// Pill buttons that run a gesture: the keyboard and screen-reader way to try a switch.
export function GesturePills({ gestures, className = "" }: { gestures: Gesture[]; className?: string }) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {gestures.map((g) => (
        <button
          key={g.gesture}
          type="button"
          onClick={g.run}
          className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-cream px-3 font-mono text-xs hover:border-filament hover:bg-filament-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-filament"
        >
          <span>{g.gesture}</span>
          <span className="text-muted">{g.action}</span>
        </button>
      ))}
    </div>
  );
}
