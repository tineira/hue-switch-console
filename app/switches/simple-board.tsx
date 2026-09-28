"use client";

// The Simple board picture on Switches: the landing's XIAO line drawing (the user's Claude Design
// model), with clickable D0–D5 pads and BOOT drawn from the same camera.
// Spec: docs/specs/simple-editor-v2.md §3.1.

import type { BoardDrawing, XiaoView } from "@/app/landing/simple-render";
import { webglAvailable } from "@/app/landing/webgl";
import { BOOT_CHANNEL_ID } from "@/lib/simple-channels";
import { useEffect, useState, useSyncExternalStore } from "react";

// Rendered at this size and scaled by CSS; the markers use the same viewBox.
const W = 360;
const H = 304;
const VIEW_KEY = "simple-board-view";
const DEFAULT_VIEW: XiaoView = "iso";

export type PadState = "selected" | "used" | "free";

export type BoardPin = {
  id: string;
  label: string;
  state: PadState;
  /** Number badge of a used pin (its place in the switch list). */
  number?: number;
  /** Tooltip, e.g. "D2: Front door" or "D3 is free. Click to add a switch here." */
  title: string;
};

function isView(value: unknown): value is XiaoView {
  return value === "iso" || value === "top";
}

function readView(): XiaoView | null {
  try {
    const stored = localStorage.getItem(VIEW_KEY);
    return isView(stored) ? stored : null;
  } catch {
    return null;
  }
}

function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function subscribeNothing() {
  return () => {};
}

export function SimpleBoard({
  pins,
  boot,
  onPick,
}: {
  /** D0–D5 as the board registered them. */
  pins: BoardPin[];
  /** Null when the board registered no BOOT channel. */
  boot: Omit<BoardPin, "id" | "label" | "number"> | null;
  onPick: (channelId: string) => void;
}) {
  const [chosen, setChosen] = useState<XiaoView | null>(null);
  const remembered = useSyncExternalStore(subscribeStorage, readView, () => null);
  const view = chosen ?? remembered ?? DEFAULT_VIEW;
  const gl = useSyncExternalStore(subscribeNothing, webglAvailable, () => true);
  const [drawing, setDrawing] = useState<{ view: XiaoView; data: BoardDrawing } | null>(null);

  // Render the still for this view, and again when the theme changes.
  useEffect(() => {
    if (!gl) return;
    let alive = true;
    const render = () => {
      import("@/app/landing/simple-render")
        .then((m) => {
          if (alive) setDrawing({ view, data: m.renderBoardDrawing(W, H, view) });
        })
        .catch(() => {});
    };
    render();
    const themeWatch = new MutationObserver(render);
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      alive = false;
      themeWatch.disconnect();
    };
  }, [gl, view]);

  function choose(next: XiaoView) {
    setChosen(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {}
  }

  if (!gl) return <PinChips pins={pins} boot={boot} onPick={onPick} />;

  return (
    <div className="relative flex justify-center">
      <div
        className="absolute left-0 -top-2 z-10 flex overflow-hidden rounded-full border border-line bg-cream"
        role="group"
        aria-label="Board view"
      >
        {(
          [
            ["top", "Top"],
            ["iso", "3D"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={view === id}
            onClick={() => choose(id)}
            className={`px-2.5 py-0.5 text-[11px] ${
              view === id ? "bg-filament-soft font-medium text-filament" : "text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="relative aspect-[360/304] w-full max-w-[360px]">
        {drawing && drawing.view === view ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- a data URL rendered in the browser */}
            <img src={drawing.data.src} alt="" className="absolute inset-0 h-full w-full" />
            <Markers drawing={drawing.data} pins={pins} boot={boot} onPick={onPick} />
          </>
        ) : null}
      </div>
    </div>
  );
}

function Markers({
  drawing,
  pins,
  boot,
  onPick,
}: {
  drawing: BoardDrawing;
  pins: BoardPin[];
  boot: Omit<BoardPin, "id" | "label" | "number"> | null;
  onPick: (channelId: string) => void;
}) {
  const placed = pins.filter((pin) => drawing.pads[pin.id]);
  const pts = placed.map((pin) => drawing.pads[pin.id]);
  if (pts.length === 0) return null;
  // Dots as big as the pad pitch allows; labels in a column left of the pads, one leader each.
  const gaps = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
  const pitch = gaps.length ? Math.min(...gaps) : 16;
  const r = Math.max(3.5, Math.min(7, pitch * 0.42));
  const colX = Math.min(...pts.map((q) => q[0])) - 26;
  const gap = Math.max(18, pitch);
  const midY = pts.reduce((sum, q) => sum + q[1], 0) / pts.length;
  // The selected pin is drawn last, so crowded neighbours in 3D never cover it.
  const order = [...placed].sort((a, b) => Number(a.state === "selected") - Number(b.state === "selected"));

  return (
    <svg viewBox={`0 0 ${drawing.w} ${drawing.h}`} className="absolute inset-0 h-full w-full overflow-visible">
      {order.map((pin) => {
        const i = placed.indexOf(pin);
        const [x, y] = drawing.pads[pin.id];
        const ly = midY + (i - (placed.length - 1) / 2) * gap;
        const sel = pin.state === "selected";
        const used = pin.state !== "free";
        return (
          <g
            key={pin.id}
            role="button"
            tabIndex={0}
            aria-label={pin.title}
            aria-current={sel ? "true" : undefined}
            className="cursor-pointer"
            onClick={() => onPick(pin.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onPick(pin.id);
              }
            }}
          >
            <title>{pin.title}</title>
            <rect x={colX - 44} y={ly - gap / 2} width={x - colX + 44 + r} height={gap} fill="transparent" />
            <line
              x1={colX + 4}
              y1={ly}
              x2={x}
              y2={y}
              stroke={sel ? "var(--foreground)" : used ? "color-mix(in srgb, var(--filament) 55%, transparent)" : "var(--line)"}
              strokeWidth={sel ? 1.75 : 1}
            />
            {sel ? <circle cx={x} cy={y} r={r + 4} fill="var(--background)" stroke="var(--foreground)" strokeWidth={2} /> : null}
            <circle
              cx={x}
              cy={y}
              r={sel ? r + 0.5 : r}
              fill={sel ? "var(--filament)" : used ? "var(--filament-soft)" : "var(--background)"}
              stroke={used ? "var(--filament)" : "var(--foreground)"}
              strokeWidth={1.25}
            />
            {sel ? (
              <>
                <rect x={colX - 21} y={ly - 8} width={24} height={16} rx={4} fill="var(--foreground)" />
                <text
                  x={colX - 9}
                  y={ly + 0.5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="font-mono text-[11px] font-bold"
                  fill="var(--background)"
                >
                  {pin.label}
                </text>
              </>
            ) : (
              <text
                x={colX}
                y={ly}
                textAnchor="end"
                dominantBaseline="middle"
                className={`font-mono text-[11px] ${used ? "font-semibold" : "font-medium"}`}
                fill={used ? "var(--foreground)" : "var(--muted)"}
              >
                {pin.label}
              </text>
            )}
            {pin.number ? (
              <>
                <circle cx={colX - 32} cy={ly} r={8} fill="var(--filament)" />
                <text
                  x={colX - 32}
                  y={ly + 0.5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-[9px] font-bold"
                  fill="var(--filament-ink)"
                >
                  {pin.number}
                </text>
              </>
            ) : null}
          </g>
        );
      })}
      {boot ? <BootMarker drawing={drawing} boot={boot} onPick={onPick} /> : null}
    </svg>
  );
}

// BOOT: a leader up and out to a label above the board, flipping left near the right edge.
function BootMarker({
  drawing,
  boot,
  onPick,
}: {
  drawing: BoardDrawing;
  boot: Omit<BoardPin, "id" | "label" | "number">;
  onPick: (channelId: string) => void;
}) {
  const [bx, by] = drawing.boot;
  const sel = boot.state === "selected";
  const used = boot.state !== "free";
  const side = bx + 64 > drawing.w ? -1 : 1;
  const ky = Math.min(by - 22, 14), kx = bx + side * 10, tx = kx + side * 14;
  const line = sel ? "var(--foreground)" : used ? "color-mix(in srgb, var(--filament) 55%, transparent)" : "var(--muted)";
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={boot.title}
      aria-current={sel ? "true" : undefined}
      className="cursor-pointer"
      onClick={() => onPick(BOOT_CHANNEL_ID)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onPick(BOOT_CHANNEL_ID);
        }
      }}
    >
      <title>{boot.title}</title>
      <circle cx={bx} cy={by} r={12} fill="transparent" />
      <rect x={side > 0 ? kx : tx - 44} y={ky - 9} width={Math.abs(tx - kx) + 44} height={18} fill="transparent" />
      <polyline points={`${bx},${by} ${kx},${ky} ${tx - side * 3},${ky}`} fill="none" stroke={line} strokeWidth={sel ? 1.75 : 1} />
      {sel ? <circle cx={bx} cy={by} r={8} fill="var(--background)" stroke="var(--foreground)" strokeWidth={2} /> : null}
      <circle
        cx={bx}
        cy={by}
        r={4.5}
        fill={sel ? "var(--filament)" : used ? "var(--filament-soft)" : "var(--background)"}
        stroke={used ? "var(--filament)" : "var(--foreground)"}
        strokeWidth={1.25}
      />
      {sel ? (
        <>
          <rect x={side > 0 ? tx - 3 : tx - 37} y={ky - 8} width={40} height={16} rx={4} fill="var(--foreground)" />
          <text
            x={side > 0 ? tx + 17 : tx - 17}
            y={ky + 0.5}
            textAnchor="middle"
            dominantBaseline="middle"
            className="font-mono text-[11px] font-bold"
            fill="var(--background)"
          >
            BOOT
          </text>
        </>
      ) : (
        <text
          x={tx}
          y={ky}
          textAnchor={side > 0 ? "start" : "end"}
          dominantBaseline="middle"
          className={`font-mono text-[11px] ${used ? "font-semibold" : "font-medium"}`}
          fill={used ? "var(--foreground)" : "var(--muted)"}
        >
          BOOT
        </text>
      )}
    </g>
  );
}

// Without WebGL there is no picture: a row of pin chips does the same job.
function PinChips({
  pins,
  boot,
  onPick,
}: {
  pins: BoardPin[];
  boot: Omit<BoardPin, "id" | "label" | "number"> | null;
  onPick: (channelId: string) => void;
}) {
  const chip = (state: PadState) =>
    `rounded-md border px-2.5 py-1 font-mono text-xs ${
      state === "selected"
        ? "border-foreground bg-foreground text-background"
        : state === "used"
          ? "border-filament bg-filament-soft"
          : "border-line text-muted"
    }`;
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pins">
      {boot ? (
        <button type="button" title={boot.title} onClick={() => onPick(BOOT_CHANNEL_ID)} className={chip(boot.state)}>
          BOOT
        </button>
      ) : null}
      {pins.map((pin) => (
        <button key={pin.id} type="button" title={pin.title} onClick={() => onPick(pin.id)} className={chip(pin.state)}>
          {pin.label}
        </button>
      ))}
    </div>
  );
}
