"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { renderOnce } from "@/app/how-to/illo/illo";
import type { Still } from "@/app/how-to/illo/render";
import type { IlloId } from "@/lib/how-to-build";
import type { Product } from "@/lib/how-to";
import { webglAvailable } from "@/app/landing/webgl";

// The picture on a /how-to switch card: a build-guide still without its callouts, cropped to
// what's drawn and fitted into a fixed 16:10 box, so both cards line up
// (docs/specs/finished/how-to-navigation.md §2.7). `keep` trims the top of the drawing to zoom in on the
// board (the Simple's cable). The Simple's LED shows the working heartbeat.
const CARD: Record<Product, { scene: IlloId; keep: number }> = {
  round: { scene: "round-done", keep: 1 },
  simple: { scene: "simple-led", keep: 0.68 },
};

type Box = [x: number, y: number, w: number, h: number];
type Pic = { still: Still; box: Box; glow: string };

const boxes = new Map<string, Promise<Box>>();

// The still's drawn bounds, in still units: the renderer clears to transparent.
function drawnBox(still: Still): Promise<Box> {
  const hit = boxes.get(still.src);
  if (hit) return hit;
  const job = new Promise<Box>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const g = c.getContext("2d", { willReadFrequently: true });
      if (!g) return resolve([0, 0, still.w, still.h]);
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let x0 = c.width;
      let y0 = c.height;
      let x1 = -1;
      let y1 = -1;
      for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
          if (d[(y * c.width + x) * 4 + 3] > 8) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }
      const k = still.w / c.width;
      resolve(x1 < 0 ? [0, 0, still.w, still.h] : [x0 * k, y0 * k, (x1 - x0 + 1) * k, (y1 - y0 + 1) * k]);
    };
    img.onerror = reject;
    img.src = still.src;
  });
  boxes.set(still.src, job);
  return job;
}

// Only the LED glow from the overlay; the callouts stay off the cards.
function glowOnly(overlay: string): string {
  return (overlay.match(/<circle[^>]*#ff8a1f[^>]*\/>/g) ?? []).join("");
}

function subscribeNothing() {
  return () => {};
}

export function ProductPicture({ product }: { product: Product }) {
  const { scene, keep } = CARD[product];
  const [pic, setPic] = useState<Pic | null>(null);
  const gl = useSyncExternalStore(subscribeNothing, webglAvailable, () => true);

  useEffect(() => {
    if (!gl) return;
    let alive = true;
    const go = () => {
      renderOnce(scene, 720, 440, (m) => m.buildScene(scene))
        .then(async (still) => {
          const [x, y, w, h] = await drawnBox(still);
          if (alive) setPic({ still, box: [x, y + h * (1 - keep), w, h * keep], glow: glowOnly(still.overlay) });
        })
        .catch(() => {});
    };
    go();
    // A new theme draws new lines.
    const themeWatch = new MutationObserver(go);
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-scheme"] });
    return () => {
      alive = false;
      themeWatch.disconnect();
    };
  }, [scene, keep, gl]);

  if (!pic) return null;
  const { still, box, glow } = pic;
  return (
    <svg
      key={still.src}
      viewBox={box.join(" ")}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      className="illo-in absolute inset-0 h-full w-full overflow-visible"
    >
      <image href={still.src} x={0} y={0} width={still.w} height={still.h} />
      {glow ? <g className="card-led-heart" dangerouslySetInnerHTML={{ __html: glow }} /> : null}
    </svg>
  );
}
