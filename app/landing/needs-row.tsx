"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { NeedKind, NeedStill } from "@/app/landing/needs-render";
import { CARD_HEADER } from "@/app/landing/parts-list";
import { webglAvailable } from "@/app/landing/webgl";

// "What you need" on the landing: three cards, each with a still line drawing rendered from a
// 3D model (Bridge, bulbs, and the two boards split diagonally under a 2.4 GHz Wi-Fi badge).

const H = 230;
const GRID =
  "[background-position:center] [background-image:repeating-linear-gradient(0deg,var(--line)_0_1px,transparent_1px_24px),repeating-linear-gradient(90deg,var(--line)_0_1px,transparent_1px_24px)]";

// Hue-ish glow colours behind the three bulbs.
const GLOWS = ["#ffb35c", "#ff6fa8", "#7fa8ff"];

/** Renders `kinds` once the box is near the viewport, and again on resize or theme change. Each
 *  drawing is `size` times the box, so it can sit in a corner without stretching. */
function useStills(kinds: NeedKind[], pad = 0.14, size = 1) {
  const ref = useRef<HTMLDivElement>(null);
  const [stills, setStills] = useState<NeedStill[] | null>(null);
  const key = kinds.join(",");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let alive = true, near = false, timer: ReturnType<typeof setTimeout> | null = null;
    const render = () => {
      if (!near) return;
      const w = Math.round(el.clientWidth * size), h = Math.round(el.clientHeight * size);
      if (!w || !h) return;
      import("@/app/landing/needs-render")
        .then(async (m) => {
          if (key.includes("round")) await m.loadDialFont();
          if (!alive) return;
          setStills(key.split(",").map((k) => m.renderNeed(k as NeedKind, w, h, "--cream", pad)));
        })
        .catch(() => {});
    };
    const later = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(render, 150);
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || near) return;
        near = true;
        io.disconnect();
        render();
      },
      { rootMargin: "100% 0px" },
    );
    io.observe(el);
    let lastW = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== lastW) {
        lastW = el.clientWidth;
        later();
      }
    });
    ro.observe(el);
    const themeWatch = new MutationObserver(render);
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      io.disconnect();
      ro.disconnect();
      themeWatch.disconnect();
    };
  }, [key, pad, size]);

  return { ref, stills };
}

function Img({ src, className = "" }: { src: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- a data URL rendered in the browser
  return <img src={src} alt="" className={`absolute inset-0 h-full w-full ${className}`} />;
}

function BridgeArt() {
  const { ref, stills } = useStills(["bridge"]);
  const s = stills?.[0];
  const fg = "var(--foreground)";
  return (
    <div ref={ref} className="absolute inset-0">
      {s ? (
        <>
          <Img src={s.src} />
          <svg viewBox={`0 0 ${s.w} ${s.h}`} className="absolute inset-0 h-full w-full overflow-visible font-mono text-[11px]">
            <Callout at={s.points.button} to={[s.w - 14, 26]} anchor="end" label="Link button" fg={fg} />
            <Callout at={s.points.ethernet} to={[14, s.h - 18]} anchor="start" label="Ethernet to router" fg={fg} />
          </svg>
        </>
      ) : null}
    </div>
  );
}

function Callout({
  at,
  to,
  anchor,
  label,
  fg,
}: {
  at: [number, number];
  to: [number, number];
  anchor: "start" | "end";
  label: string;
  fg: string;
}) {
  // Label on a short shelf, then one straight leader to the part.
  const shelf: [number, number] = [anchor === "end" ? to[0] - label.length * 6.6 - 8 : to[0] + label.length * 6.6 + 8, to[1] + 6];
  return (
    <g>
      <text x={to[0]} y={to[1]} textAnchor={anchor} dominantBaseline="middle" fill={fg}>
        {label}
      </text>
      <line x1={to[0]} y1={to[1] + 6} x2={shelf[0]} y2={shelf[1]} stroke={fg} strokeWidth={1} />
      <line x1={shelf[0]} y1={shelf[1]} x2={at[0]} y2={at[1]} stroke={fg} strokeWidth={1} />
      <circle cx={at[0]} cy={at[1]} r={2} fill={fg} />
    </g>
  );
}

function LightsArt() {
  const { ref, stills } = useStills(["lights"]);
  const s = stills?.[0];
  return (
    <div ref={ref} className="absolute inset-0">
      {s ? (
        <>
          {/* Glow sits under the drawing: the bulbs' fill hides it, so it shows as a halo. */}
          <svg viewBox={`0 0 ${s.w} ${s.h}`} className="absolute inset-0 h-full w-full overflow-visible">
            <defs>
              {GLOWS.map((c, i) => (
                <radialGradient key={c} id={`need-glow-${i}`}>
                  <stop offset="0" stopColor={c} stopOpacity={0.55} />
                  <stop offset="1" stopColor={c} stopOpacity={0} />
                </radialGradient>
              ))}
            </defs>
            {GLOWS.map((c, i) => {
              const p = s.points[`bulb${i}`];
              return p ? <circle key={c} cx={p[0]} cy={p[1]} r={s.h * 0.3} fill={`url(#need-glow-${i})`} /> : null;
            })}
          </svg>
          <Img src={s.src} />
        </>
      ) : null}
    </div>
  );
}

// Upper-left triangle: the XIAO C6 (Simple). Lower-right: the Round Display. The diagonal runs
// from the bottom-left corner to the top-right one, where the Wi-Fi badge sits across it.
const UPPER = "polygon(0 0, 100% 0, 0 100%)";
const LOWER = "polygon(100% 0, 100% 100%, 0 100%)";

function BoardsArt() {
  const { ref, stills } = useStills(["xiao", "round"], 0.08, 0.6);
  return (
    <div ref={ref} className="absolute inset-0">
      {stills ? (
        <>
          <div className="absolute inset-0" style={{ clipPath: UPPER }}>
            <div className="absolute left-0 top-0 h-[60%] w-[60%]">
              <Img src={stills[0].src} />
            </div>
          </div>
          <div className="absolute inset-0" style={{ clipPath: LOWER }}>
            <div className="absolute bottom-0 right-0 h-[60%] w-[60%]">
              <Img src={stills[1].src} />
            </div>
          </div>
        </>
      ) : null}
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden="true">
        <line x1="0" y1="100" x2="100" y2="0" stroke="var(--muted)" strokeWidth={1} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="absolute bottom-3 left-[18px] font-mono text-[11px] text-muted">Simple · C6</span>
      <span className="absolute right-[18px] font-mono text-[11px] text-muted" style={{ top: 50 }}>
        Round · S3
      </span>
      <WifiBadge />
    </div>
  );
}

function WifiBadge() {
  return (
    <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-line bg-background px-2.5 py-1 font-mono text-[11px] text-foreground">
      <svg width="16" height="13" viewBox="0 0 24 19" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
        <path d="M1.5 6.5a15 15 0 0 1 21 0" />
        <path d="M5.2 10.3a9.7 9.7 0 0 1 13.6 0" />
        <path d="M8.9 14a4.4 4.4 0 0 1 6.2 0" />
        <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
      </svg>
      2.4 GHz
    </div>
  );
}

const CARDS: { label: string; title: string; text: ReactNode; art: () => ReactNode }[] = [
  {
    label: "01 · Bridge",
    title: "A Hue Bridge",
    text: "Plugged into your router. The switch talks to it over your home network, so bulbs paired only by Bluetooth won't work.",
    art: () => <BridgeArt />,
  },
  {
    label: "02 · Lights",
    title: "Hue lights, set up in the Hue app",
    text: "Rooms, zones and scenes come from the Bridge. Make them in the Hue app first; the switch picks them up when it pairs.",
    art: () => <LightsArt />,
  },
  {
    label: "03 · Board",
    title: "A switch on 2.4 GHz Wi-Fi",
    text: "A XIAO ESP32-C6 for Simple, or the Round Display with a XIAO ESP32-S3. It joins your 2.4 GHz network, the one the Bridge is on.",
    art: () => <BoardsArt />,
  },
];

export function NeedsRow() {
  // Without WebGL the cards keep their text and drop the drawings.
  const [gl, setGl] = useState(true);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- WebGL support is only known in the browser
    setGl(webglAvailable());
  }, []);

  return (
    <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-4">
      {CARDS.map((card) => (
        <li key={card.label} className="flex flex-col overflow-hidden rounded-[20px] border border-line bg-cream">
          <div className={CARD_HEADER}>
            <span>{card.label}</span>
          </div>
          {gl ? (
            <div aria-hidden="true" className={`relative border-b border-line ${GRID}`} style={{ height: H }}>
              {card.art()}
            </div>
          ) : null}
          <div className="flex flex-col gap-1.5 px-[18px] pb-5 pt-4">
            <h3 className="text-lg font-semibold">{card.title}</h3>
            <p className="text-pretty text-[15px] leading-normal text-muted">{card.text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
