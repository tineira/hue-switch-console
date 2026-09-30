import type { CSSProperties, ReactNode } from "react";
import type { FaceKind, Pattern, Visual } from "@/lib/how-to";
import { LedBoard } from "@/app/how-to/led-board";

// Ring colours and pulses live in globals.css (.round-face-*) and mirror ui.h in hue-round-switch.
type Ring = "wait" | "loading" | "pairing" | "error" | "mute" | "ready";

// .led is drawn at 14 px and .round-face at 88 px; --k scales both, like .round-dial.
const LED_BASE = 14;
const FACE_BASE = 88;
// Smallest size that shows the LED on the XIAO close-up rather than as a plain dot.
const BOARD_MIN = 56;

function scale(size: number, base: number): CSSProperties | undefined {
  return size === base ? undefined : ({ ["--k" as string]: size / base } as CSSProperties);
}

export function Led({ pattern, label, size = LED_BASE }: { pattern: Pattern; label: string; size?: number }) {
  return (
    <span
      role="img"
      aria-label={label}
      className={`led led-${pattern}`}
      style={scale(size, LED_BASE)}
    />
  );
}

export function Face({
  ring,
  flash,
  label,
  size = FACE_BASE,
  children,
}: {
  ring: Ring;
  flash?: boolean;
  label: string;
  size?: number;
  children: ReactNode;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`round-face round-face-${ring}${flash ? " round-face-flash" : ""}`}
      style={scale(size, FACE_BASE)}
    >
      {children}
    </div>
  );
}

export function FaceText({ line, sub }: { line: string; sub?: string }) {
  return (
    <>
      <span className="round-face-line">{line}</span>
      {sub ? <span className="round-face-sub">{sub}</span> : null}
    </>
  );
}

export function FaceEmpty() {
  return <span className="round-face-name">Page</span>;
}

export function FaceReady({ tokenDot }: { tokenDot?: boolean }) {
  return (
    <>
      <span className="round-face-disc" />
      <span className="round-face-name">Living room</span>
      <span className="round-face-sub">Relax</span>
      <span className="round-face-dots">
        <i className="on" />
        <i />
        <i />
      </span>
      {tokenDot ? <span className="round-face-token" /> : null}
    </>
  );
}

// What each Round screen draws. The text is the firmware's, word for word.
function faceParts(kind: FaceKind, version: string | null): { ring: Ring; flash?: boolean; body: ReactNode } {
  switch (kind) {
    case "wifi":
      return { ring: "wait", body: <FaceText line="Wi-Fi..." sub={version ?? undefined} /> };
    case "nowifi":
      return { ring: "error", body: <FaceText line="No Wi-Fi" sub="Plug the antenna" /> };
    case "loading":
      return { ring: "loading", body: <FaceText line="Loading..." sub="Connecting" /> };
    case "pairing":
      return { ring: "pairing", body: <FaceText line="Press Bridge button" sub="on the Hue Bridge" /> };
    case "nobridge":
      return { ring: "error", body: <FaceText line="No Bridge" sub="same LAN as Bridge" /> };
    case "empty":
      return { ring: "mute", body: <FaceEmpty /> };
    case "ready":
      return { ring: "ready", body: <FaceReady /> };
    case "flash":
      return { ring: "ready", flash: true, body: <FaceReady /> };
    case "token":
      return { ring: "ready", body: <FaceReady tokenDot /> };
    case "tokenfull":
      return { ring: "error", body: <FaceText line="Token rejected" sub="Set a new one in Setup" /> };
  }
}

// One visual at a nominal size in px. From BOARD_MIN up, the LED is shown on the XIAO close-up;
// the plain dot (about a fifth of the size, never under 14 px) is the small and no-WebGL form.
export function StateVisual({
  visual,
  label,
  size,
  version,
}: {
  visual: Visual;
  label: string;
  size: number;
  version: string | null;
}) {
  if ("led" in visual) {
    const dot = <Led pattern={visual.led} label={label} size={Math.max(LED_BASE, Math.round(size / 5))} />;
    // Below this the board close-up is too small to read: the plain dot.
    if (size < BOARD_MIN) return dot;
    return <LedBoard pattern={visual.led} label={label} size={size} fallback={dot} />;
  }
  const { ring, flash, body } = faceParts(visual.face, version);
  return (
    <Face ring={ring} flash={flash} label={label} size={size}>
      {body}
    </Face>
  );
}
