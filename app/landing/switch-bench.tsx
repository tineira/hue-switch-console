"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { ROUND_THEMES, type RoundTheme, type RoundThemeId } from "@/lib/round-themes";

// Live demos of both switches on the signed-out home page. Gesture timings follow the
// firmware: 240 ms double-tap window, 420 ms hold. Device colours are fixed, not theme tokens.

const DOUBLE_MS = 240;
const HOLD_MS = 420;
const MONO = "font-mono";

function palette(id: RoundThemeId): RoundTheme {
  return ROUND_THEMES.find((t) => t.id === id) ?? ROUND_THEMES[0];
}

// Each Round page has its own screen theme (docs/definitions.md).
const PAGES = [
  { name: "Living", scenes: ["Sunset", "Aurora", "Relax", "Read"], pal: palette("ember") },
  { name: "Kitchen", scenes: ["Bright", "Lagoon", "Dimmed"], pal: palette("ocean") },
  { name: "Bedroom", scenes: ["Neon", "Nightlight", "Relax"], pal: palette("violet") },
];
const SIMPLE_SCENES = ["Bright", "Tropics", "Nightlight"];

// Whites are one colour; colour scenes are a palette spread over the lights in the room.
const SCENE_COLOURS: Record<string, string[]> = {
  Relax: ["255 172 92"],
  Read: ["255 222 176"],
  Bright: ["255 238 212"],
  Dimmed: ["255 186 120"],
  Nightlight: ["255 120 40"],
  Sunset: ["255 128 52", "255 64 112", "176 64 210"],
  Aurora: ["40 220 160", "64 132 255", "168 88 255"],
  Lagoon: ["0 196 224", "36 112 255", "110 240 196"],
  Neon: ["255 40 160", "118 56 255", "0 196 255"],
  Tropics: ["255 176 0", "255 72 96", "0 200 170"],
};
const SPOTS = ["18% -12%", "82% -12%", "50% 118%"];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// A room lit by its lights: glows fade in with level, a dark layer covers it when dim or off.
function Room({ on, level, scene, still }: { on: boolean; level: number; scene: string | null; still?: boolean }) {
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
      <div className={`${layer} inset-0 bg-black`} style={{ opacity: on ? 0.42 * (1 - L) : 0.55 }} />
      <div className={`${layer} inset-0`} style={{ opacity: L * 0.95, background: glow }} />
      <div
        className={`${layer} left-1/2 top-0 -ml-8 h-[5px] w-16 rounded-b-md`}
        style={{
          background: on ? strip : "var(--line)",
          boxShadow: on ? `0 0 ${10 + L * 30}px ${2 + L * 8}px rgb(${pal[0]} / ${0.35 + L * 0.5})` : "none",
        }}
      />
    </div>
  );
}

type RoundState = { page: number; on: boolean; level: number; scene: number };

// Same geometry as .round-dial, drawn at 104 and scaled by k.
function RoundScreen({
  size,
  state,
  onTap,
  onDouble,
  onLevel,
  onSwipe,
}: {
  size: number;
  state: RoundState;
  onTap: () => void;
  onDouble: () => void;
  onLevel: (v: number) => void;
  onSwipe: (dir: number) => void;
}) {
  const k = size / 104;
  const page = PAGES[state.page];
  const T = page.pal;
  const ref = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ x: number; y: number; ring: boolean; moved: boolean } | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (tapTimer.current) clearTimeout(tapTimer.current);
  }, []);

  function geo(e: PointerEvent) {
    const r = ref.current!.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    return { dx, dy, d: Math.hypot(dx, dy), R: r.width / 2 };
  }
  function levelAt(e: PointerEvent) {
    const { dx, dy } = geo(e);
    const a = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
    let rel = (a - 225 + 360) % 360;
    if (rel > 270) rel = rel > 315 ? 0 : 270;
    return Math.round((rel / 270) * 100);
  }
  function down(e: PointerEvent) {
    const { d, R } = geo(e);
    const ring = d > R * 0.62;
    gesture.current = { x: e.clientX, y: e.clientY, ring, moved: false };
    try {
      ref.current!.setPointerCapture(e.pointerId);
    } catch {}
    if (ring) onLevel(levelAt(e));
  }
  function move(e: PointerEvent) {
    const g = gesture.current;
    if (!g) return;
    if (Math.abs(e.clientX - g.x) > 6 || Math.abs(e.clientY - g.y) > 6) g.moved = true;
    if (g.ring) onLevel(levelAt(e));
  }
  function up(e: PointerEvent) {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.ring) return;
    const dx = e.clientX - g.x;
    if (Math.abs(dx) > 30) {
      onSwipe(dx < 0 ? 1 : -1);
      return;
    }
    if (g.moved) return;
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      onDouble();
    } else {
      tapTimer.current = setTimeout(() => {
        tapTimer.current = null;
        onTap();
      }, DOUBLE_MS);
    }
  }

  const { on } = state;
  const deg = clamp(state.level, 0, 100) * 2.7;
  const accent = on ? T.accent : T.track;
  const mask = `radial-gradient(farthest-side, transparent calc(100% - ${8 * k}px), #000 calc(100% - ${8 * k - 1}px))`;
  const ring: CSSProperties = { position: "absolute", inset: 4 * k, borderRadius: "50%", WebkitMask: mask, mask };
  const scene = page.scenes[state.scene];

  return (
    <div className="relative p-4">
      <div
        ref={ref}
        aria-hidden="true"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => {
          gesture.current = null;
        }}
        className="relative cursor-pointer touch-none select-none overflow-hidden rounded-full"
        style={{
          width: size,
          height: size,
          background: T.bg,
          boxShadow: "0 0 0 9px #0b0b0c, 0 0 0 10px rgb(255 255 255 / 7%), 0 22px 44px rgb(0 0 0 / 40%)",
        }}
      >
        <div style={{ ...ring, background: `conic-gradient(from 225deg, ${T.track} 0 270deg, transparent 270deg 360deg)` }} />
        <div
          style={{
            ...ring,
            opacity: on ? 1 : 0.35,
            background: `conic-gradient(from 225deg, ${accent} 0 ${deg}deg, transparent ${deg}deg 360deg)`,
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            inset: 16 * k,
            background: on ? T.fillOn : T.fillOff,
            boxShadow: `inset 0 0 0 ${2 * k}px ${accent}`,
            transition: "background 300ms, box-shadow 300ms",
          }}
        />
        <div
          className={`pointer-events-none absolute flex flex-col items-center justify-center text-center ${MONO}`}
          style={{ inset: 16 * k }}
        >
          <div
            className="whitespace-nowrap"
            style={{ fontSize: 11 * k, letterSpacing: 0.3 * k, color: on ? T.ink : T.mute, marginBottom: 3 * k }}
          >
            {page.name}
          </div>
          {on && scene ? (
            <div className="whitespace-nowrap" style={{ fontSize: 7 * k, letterSpacing: 0.2 * k, color: T.ink, opacity: 0.88 }}>
              {scene}
            </div>
          ) : null}
        </div>
        <div className="absolute left-1/2 flex -translate-x-1/2" style={{ bottom: 22 * k, gap: 3 * k }}>
          {PAGES.map((p, i) => (
            <i
              key={p.name}
              className="block rounded-full"
              style={{
                width: 4 * k,
                height: 4 * k,
                background: i === state.page ? (on ? T.ink : T.mute) : `color-mix(in srgb, ${T.ink} 30%, transparent)`,
              }}
            />
          ))}
        </div>
      </div>
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

type SimpleState = { on: boolean; level: number; scene: number; holding: boolean; pulse: number };

function WallPlate({
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
        <span className={`${MONO} text-[10px] text-muted`}>status LED</span>
      </div>
    </div>
  );
}

type Gesture = { gesture: string; action: string; run: () => void };

function DeviceColumn({
  name,
  chip,
  room,
  device,
  gestures,
  readout,
}: {
  name: string;
  chip: string;
  room: ReactNode;
  device: ReactNode;
  gestures: Gesture[];
  readout: string;
}) {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="relative flex h-[236px] items-center justify-center overflow-hidden rounded-2xl border border-line bg-background">
        {room}
        <div className="relative">{device}</div>
      </div>
      <div className="flex flex-col items-start gap-1">
        <span className="text-[17px] font-semibold">{name}</span>
        <a
          href="#parts"
          className={`${MONO} text-xs text-muted underline decoration-dotted underline-offset-[3px] hover:text-filament`}
        >
          {chip}
        </a>
      </div>
      <div className="flex flex-col border-t border-line">
        {gestures.map((g) => (
          <button
            key={g.gesture}
            type="button"
            onClick={g.run}
            className={`flex min-h-9 cursor-pointer items-center justify-between gap-3 border-b border-line px-2 text-left ${MONO} text-xs hover:bg-filament-soft`}
          >
            <span>{g.gesture}</span>
            <span className="text-muted">{g.action}</span>
          </button>
        ))}
      </div>
      <p className={`${MONO} text-xs text-muted`} aria-live="polite">
        {readout}
      </p>
    </div>
  );
}

export function SwitchBench() {
  const [r, setR] = useState<RoundState>({ page: 0, on: true, level: 64, scene: 0 });
  const [s, setS] = useState<SimpleState>({ on: true, level: 92, scene: 1, holding: false, pulse: 0 });
  const level = useRef(s.level);
  const dir = useRef(1);
  const ramp = useRef<ReturnType<typeof setInterval> | null>(null);
  const rampEnd = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    level.current = s.level;
  }, [s.level]);
  useEffect(
    () => () => {
      if (ramp.current) clearInterval(ramp.current);
      if (rampEnd.current) clearTimeout(rampEnd.current);
    },
    [],
  );

  // Round
  const rTap = () => setR((v) => ({ ...v, on: !v.on }));
  const rScene = () => setR((v) => ({ ...v, on: true, scene: (v.scene + 1) % PAGES[v.page].scenes.length }));
  const rLevel = (lv: number) => setR((v) => ({ ...v, level: lv, on: lv > 0 }));
  const rDim = () => setR((v) => ({ ...v, on: true, level: v.level >= 90 ? 25 : Math.min(100, v.level + 25) }));
  const rSwipe = (d: number) =>
    setR((v) => ({ ...v, page: (v.page + d + PAGES.length) % PAGES.length, scene: 0, on: true }));

  // Simple: every event flashes the LED once.
  const event = (f: (v: SimpleState) => Partial<SimpleState>) => setS((v) => ({ ...v, ...f(v), pulse: v.pulse + 1 }));
  const sClick = () => event((v) => ({ on: !v.on, scene: v.on ? -1 : v.scene }));
  const sScene = () => event((v) => ({ on: true, scene: (v.scene + 1) % SIMPLE_SCENES.length }));
  function sHoldStart() {
    dir.current = level.current >= 100 ? -1 : 1;
    event(() => ({ on: true, holding: true }));
    if (ramp.current) clearInterval(ramp.current);
    ramp.current = setInterval(() => {
      let l = level.current + dir.current * 3;
      if (l >= 100 || l <= 5) dir.current *= -1;
      l = clamp(l, 5, 100);
      level.current = l;
      setS((v) => ({ ...v, level: l }));
    }, 60);
  }
  function sHoldEnd() {
    if (ramp.current) clearInterval(ramp.current);
    ramp.current = null;
    setS((v) => ({ ...v, holding: false }));
  }
  function sHoldDemo() {
    if (rampEnd.current) clearTimeout(rampEnd.current);
    sHoldStart();
    rampEnd.current = setTimeout(sHoldEnd, 1100);
  }

  const page = PAGES[r.page];
  const roundScene = page.scenes[r.scene];
  const simpleScene = s.scene >= 0 ? SIMPLE_SCENES[s.scene] : null;

  return (
    <div
      role="group"
      aria-label="Interactive preview of both switches"
      className="flex flex-col gap-[18px] rounded-3xl border border-line bg-cream p-[clamp(16px,2.4cqi,28px)]"
    >
      <div className={`flex justify-between gap-3 ${MONO} text-[11px] uppercase tracking-[0.06em] text-muted`}>
        <span>Try them</span>
        <span className="text-right">Same gestures as the real switch</span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-4">
        <DeviceColumn
          name="Round"
          chip="XIAO ESP32-S3 · Round Display"
          room={<Room on={r.on} level={r.level} scene={roundScene} />}
          device={
            <RoundScreen size={172} state={r} onTap={rTap} onDouble={rScene} onLevel={rLevel} onSwipe={rSwipe} />
          }
          gestures={[
            { gesture: "tap", action: "on / off", run: rTap },
            { gesture: "double tap", action: "scenes", run: rScene },
            { gesture: "drag the ring", action: "dim", run: rDim },
            { gesture: "swipe", action: "next room", run: () => rSwipe(1) },
          ]}
          readout={`→ ${page.name} · ${r.on ? `${roundScene} · ${r.level}%` : "off"}`}
        />
        <DeviceColumn
          name="Simple"
          chip="XIAO ESP32-C6"
          room={<Room on={s.on} level={s.level} scene={simpleScene} still={s.holding} />}
          device={
            <WallPlate state={s} onClick={sClick} onDouble={sScene} onHoldStart={sHoldStart} onHoldEnd={sHoldEnd} />
          }
          gestures={[
            { gesture: "click", action: "on / off", run: sClick },
            { gesture: "double-click", action: "scenes", run: sScene },
            { gesture: "hold", action: "dim", run: sHoldDemo },
          ]}
          readout={`→ Hallway · ${s.on ? `${simpleScene ? `${simpleScene} · ` : ""}${s.level}%` : "off"}`}
        />
      </div>
    </div>
  );
}
