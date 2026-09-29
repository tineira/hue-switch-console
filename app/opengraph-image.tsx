import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { isHostedConsole } from "@/lib/account-config";

// Link preview for every page (GitHub, X, chat apps). Paper theme colors from globals.css; the
// switch is the landing page's Round demo (Living, Sunset) in its Ember screen theme.
export const alt = "Hue Switch Console: build a Wi-Fi wall switch for your Philips Hue lights";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = { bg: "#f3eee4", ink: "#1c1814", muted: "#6e675c", line: "#e0d4c4", filament: "#c45c26" };
const SCREEN = { ink: "#eee8e0", fill: "#a54a00", accent: "#ff9e00", track: "#313131" };

// Switch drawn in a 400 × 400 box. Angles run clockwise from 12 o'clock.
const S = 400;
const C = S / 2;
const RING = 138;

function point(deg: number, r: number) {
  const rad = (deg * Math.PI) / 180;
  return `${(C + r * Math.sin(rad)).toFixed(1)} ${(C - r * Math.cos(rad)).toFixed(1)}`;
}

// Brightness arc from 7:30 round the top to 2 o'clock, as on the landing demo.
const ARC = `M ${point(225, RING)} A ${RING} ${RING} 0 1 1 ${point(60, RING)}`;

function RoundSwitch() {
  return (
    <div
      style={{
        position: "relative",
        width: S,
        height: S,
        display: "flex",
        borderRadius: S / 2,
        boxShadow: "0 28px 60px rgba(60, 40, 20, 0.28)",
      }}
    >
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`}>
        <circle cx={C} cy={C} r={200} fill="#3f3f3f" />
        <circle cx={C} cy={C} r={186} fill="#2c2c2c" />
        <circle cx={C} cy={C} r={172} fill="#1e1e1e" />
        <circle cx={C} cy={C} r={RING} fill="none" stroke={SCREEN.track} strokeWidth={34} />
        <path d={ARC} fill="none" stroke={SCREEN.accent} strokeWidth={34} />
        <circle cx={C} cy={C} r={100} fill={SCREEN.fill} stroke={SCREEN.accent} strokeWidth={8} />
        <circle cx={C - 20} cy={C + 58} r={6} fill={SCREEN.ink} />
        <circle cx={C} cy={C + 58} r={6} fill={SCREEN.ink} opacity={0.4} />
        <circle cx={C + 20} cy={C + 58} r={6} fill={SCREEN.ink} opacity={0.4} />
      </svg>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: S,
          height: S,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Geist Mono",
          color: SCREEN.ink,
          paddingBottom: 26,
        }}
      >
        <div style={{ fontSize: 44 }}>Living</div>
        <div style={{ fontSize: 24, opacity: 0.85 }}>Sunset</div>
      </div>
    </div>
  );
}

export default async function OpengraphImage() {
  const [semibold, mono] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/Geist-SemiBold.ttf")),
    readFile(join(process.cwd(), "assets/fonts/GeistMono-Regular.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 72px 0 80px",
          background: PAPER.bg,
          color: PAPER.ink,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: 600 }}>
          <div style={{ fontFamily: "Geist Mono", fontSize: 22, letterSpacing: 3, color: PAPER.muted }}>
            HUE SWITCH CONSOLE
          </div>
          <div
            style={{
              marginTop: 28,
              fontFamily: "Geist",
              fontWeight: 600,
              fontSize: 68,
              lineHeight: 1.05,
              letterSpacing: -1.4,
            }}
          >
            Build a wall switch for your Hue lights.
          </div>
          <div style={{ marginTop: 36, height: 2, width: 520, background: PAPER.line }} />
          <div style={{ marginTop: 28, fontFamily: "Geist Mono", fontSize: 24, color: PAPER.filament }}>
            {isHostedConsole() ? "hue.tineira.com · free and open source" : "Free and open source"}
          </div>
        </div>
        <RoundSwitch />
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: semibold, weight: 600, style: "normal" },
        { name: "Geist Mono", data: mono, weight: 400, style: "normal" },
      ],
    },
  );
}
