import type { IlloId } from "@/lib/how-to-build";

// Each picture's height at 720 px wide (renderStill(scene, 720, 440).h). The frame fits the
// scene's own geometry and callouts, so it is fixed per scene; the page reserves this box from
// the first paint, so nothing below moves when the picture arrives. In development, illo.tsx
// logs an error when a render comes out at another height: update the number here.
export const ILLO_HEIGHT: Record<IlloId, number> = {
  "round-kit": 289,
  "round-headers": 336,
  "round-antenna": 220,
  "round-dip": 440,
  "round-below": 419,
  "round-switch": 360,
  "round-done": 220,
  "simple-kit-try": 440,
  "simple-plug": 440,
  "simple-led": 440,
  "simple-boot": 440,
  "simple-buttons": 440,
  "round-plug": 220,
  "hue-bridge": 434,
  "simple-kit-box": 307,
  "simple-wires": 440,
  "simple-switch": 440,
  "simple-test": 440,
  "simple-all": 239,
  "simple-rc": 440,
  "simple-rc3": 334,
  "simple-box": 322,
  "wall-board": 440,
  "wall-usb": 403,
  "wall-breaker": 422,
  "wall-before": 316,
  "wall-identify": 352,
  "wall-lamp": 321,
  "wall-offmains": 408,
  "wall-switches": 440,
  "wall-mains": 440,
  "wall-check": 338,
  "wall-fit": 343,
  "wall-after": 343,
  "wall-on": 440,
};
