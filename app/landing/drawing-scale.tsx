"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const W = 520;
const H = 440;

// Scales a fixed 520×440 drawing down to the card width. The height follows in CSS, so the
// card does not jump when the scale arrives after hydration.
export function DrawingScale({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / W));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="relative w-full overflow-hidden [background-position:center] [background-image:repeating-linear-gradient(0deg,var(--line)_0_1px,transparent_1px_24px),repeating-linear-gradient(90deg,var(--line)_0_1px,transparent_1px_24px)]"
      style={{ height: `min(${H}px, calc(100cqw * ${H} / ${W}))` }}
    >
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-0 font-mono text-foreground"
        style={{ width: W, height: H, transform: `translateX(-50%) scale(${scale})`, transformOrigin: "top center" }}
      >
        {children}
      </div>
    </div>
  );
}
