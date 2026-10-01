"use client";

import { useEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import type { Still } from "@/app/how-to/illo/render";
import { renderOnce, themeKey } from "@/app/how-to/illo/illo";
import { webglAvailable } from "@/app/landing/webgl";
import type { Pattern } from "@/lib/how-to";

// The Simple switch's status LED shown where it is: a close-up of the XIAO model around the LED
// (illo/scenes.ts ledCloseup, rendered once per theme), with the blinking LED (.led-* in
// globals.css, the firmware's timings) placed on the LED's projected position. Until the render
// is ready it is an empty box of the final size; the plain dot is only for no WebGL.

const RENDER = 320; // the still's size in CSS px (its fixed 16 px margins are small at this size); shown scaled down
const LED_MM = 1.3; // the LED package as drawn on the board

function subscribeNothing() {
  return () => {};
}

function useCloseup(enabled: boolean): Still | null {
  const [still, setStill] = useState<Still | null>(null);
  const [theme, setTheme] = useState("");
  useEffect(() => {
    if (!enabled) return;
    const sync = () => setTheme(themeKey());
    sync();
    const watch = new MutationObserver(sync);
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-scheme"] });
    return () => watch.disconnect();
  }, [enabled]);
  useEffect(() => {
    if (!enabled || !theme) return;
    let alive = true;
    renderOnce("led-closeup", RENDER, RENDER, (m) => m.ledCloseup())
      .then((s) => alive && setStill(s))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [enabled, theme]);
  return still;
}

export function LedBoard({
  pattern,
  label,
  size,
  fallback,
}: {
  pattern: Pattern;
  label: string;
  size: number;
  fallback: ReactNode;
}) {
  // The server snapshot says "WebGL": the server and the first client render show the empty
  // placeholder, never the dot, which only appears once WebGL is known to be missing.
  const gl = useSyncExternalStore(subscribeNothing, webglAvailable, () => true);
  const still = useCloseup(gl);
  if (!gl) return <>{fallback}</>;
  const led = still?.points.led;
  // Always a size × size box, so nothing moves when the board arrives.
  if (!still || !led) return <span role="img" aria-label={label} className="block shrink-0" style={{ width: size, height: size }} />;
  const k = Math.min(size / still.w, size / still.h);
  const w = still.w * k, h = still.h * k;
  const d = Math.max(4, LED_MM * still.mmPx * k);
  const style = {
    position: "absolute",
    left: led[0] * k - d * 0.7,
    top: led[1] * k - d / 2,
    width: d * 1.4,
    height: d,
    ["--d" as string]: `${d}px`,
  } as CSSProperties;
  return (
    <span role="img" aria-label={label} className="flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <span className="led-board-in relative block" style={{ width: w, height: h }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a data URL rendered in the browser */}
        <img src={still.src} alt="" className="absolute inset-0 h-full w-full rounded-md" />
        <span className={`led led-onboard led-${pattern}`} style={style} />
      </span>
    </span>
  );
}
