"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { IlloId } from "@/app/how-to/illo/scenes";
import type { Still } from "@/app/how-to/illo/render";
import { webglAvailable } from "@/app/landing/webgl";
import { ILLO_HEIGHT } from "@/app/how-to/illo/heights";

// One build-guide illustration: rendered from the 3D models when it scrolls near, once per
// theme, one at a time (each render opens and closes its own WebGL context).

const W = 720;
const H = 440;

const cache = new Map<string, Still>();
let queue: Promise<unknown> = Promise.resolve();

export function themeKey() {
  const el = document.documentElement;
  return `${el.dataset.theme ?? ""}|${el.dataset.scheme ?? ""}`;
}

function render(id: IlloId): Promise<Still> {
  return renderOnce(id, W, H, (m) => m.buildScene(id)).then((still) => {
    if (process.env.NODE_ENV !== "production" && still.h !== ILLO_HEIGHT[id])
      console.error(`Illo ${id}: rendered ${still.w} x ${still.h}; set ILLO_HEIGHT["${id}"] = ${still.h} in illo/heights.ts`);
    return still;
  });
}

/**
 * Render a scene once per theme into a still, queued behind the others (each opens and closes
 * its own WebGL context). `name` keys the cache; `build` makes the scene.
 */
export function renderOnce(
  name: string,
  w: number,
  h: number,
  build: (scenes: typeof import("@/app/how-to/illo/scenes")) => import("@/app/how-to/illo/render").SceneDef,
): Promise<Still> {
  const key = `${name}|${w}x${h}|${themeKey()}`;
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const job = queue.then(async () => {
    const hit2 = cache.get(key);
    if (hit2) return hit2;
    const [scenes, { renderStill }] = await Promise.all([
      import("@/app/how-to/illo/scenes"),
      import("@/app/how-to/illo/render"),
    ]);
    const still = renderStill(build(scenes), w, h);
    cache.set(key, still);
    // Let the page breathe between renders.
    await new Promise((r) => setTimeout(r, 16));
    return still;
  });
  queue = job.catch(() => {});
  return job;
}

/**
 * A hand drawing laid over a still whose scene reports a `press` point: the fingertip on that
 * point, at life size (the drawing is 149 mm wide, its finger 17 mm). Two masks of the same
 * drawing (public/illo, made from a line drawing the maintainer supplied): its lines, painted in
 * the foreground colour, and the inside of the hand, painted in the page colour so the hand hides
 * what is behind it. Both follow the theme.
 */
const PRESS_HAND = {
  lines: "/illo/hand-press-lines.png",
  fill: "/illo/hand-press-fill.png",
  aspect: 560 / 880,
  widthMm: 149,
  tip: [0.423, 0.83] as const,
};

function PressHand({ still }: { still: Still }) {
  const at = still.points.press;
  if (!at) return null;
  const w = PRESS_HAND.widthMm * still.mmPx;
  const h = w / PRESS_HAND.aspect;
  const box = {
    left: `${((at[0] - PRESS_HAND.tip[0] * w) / still.w) * 100}%`,
    top: `${((at[1] - PRESS_HAND.tip[1] * h) / still.h) * 100}%`,
    width: `${(w / still.w) * 100}%`,
    height: `${(h / still.h) * 100}%`,
  };
  const mask = (src: string) => ({
    ...box,
    WebkitMaskImage: `url(${src})`,
    maskImage: `url(${src})`,
    WebkitMaskSize: "100% 100%",
    maskSize: "100% 100%",
  });
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <div className="absolute bg-background" style={mask(PRESS_HAND.fill)} />
      <div className="absolute bg-foreground" style={mask(PRESS_HAND.lines)} />
    </div>
  );
}

function subscribeNothing() {
  return () => {};
}

export function Illo({ id, alt }: { id: IlloId; alt: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [still, setStill] = useState<Still | null>(null);
  const gl = useSyncExternalStore(subscribeNothing, webglAvailable, () => true);

  useEffect(() => {
    const el = ref.current;
    if (!el || !gl) return;
    let alive = true;
    const go = () => {
      render(id)
        .then((s) => alive && setStill(s))
        .catch(() => {});
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          go();
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    const themeWatch = new MutationObserver(() => {
      if (still) go();
    });
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-scheme"] });
    return () => {
      alive = false;
      io.disconnect();
      themeWatch.disconnect();
    };
  }, [id, gl, still]);

  // The box has the picture's final size from the first paint (heights.ts), empty until the
  // picture is ready; then it fades in. Without WebGL it holds the description instead.
  return (
    <div
      ref={ref}
      role="img"
      aria-label={alt}
      className="relative w-full"
      style={{ aspectRatio: `${W} / ${ILLO_HEIGHT[id]}` }}
    >
      {still ? (
        <div className="illo-in absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- a data URL rendered in the browser */}
          <img src={still.src} alt="" className="absolute inset-0 h-full w-full" />
          <PressHand still={still} />
          <svg
            viewBox={`0 0 ${still.w} ${still.h}`}
            aria-hidden="true"
            className="absolute inset-0 h-full w-full overflow-visible font-mono"
            dangerouslySetInnerHTML={{ __html: still.overlay }}
          />
        </div>
      ) : gl ? null : (
        <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-muted">{alt}</div>
      )}
    </div>
  );
}
