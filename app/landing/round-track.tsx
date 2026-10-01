"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { DOUBLE_MS, PAGES, ringLevel, roundReadout, type RoundState } from "@/app/landing/demo-data";
import { GesturePills, Room } from "@/app/landing/demo-parts";
import { RoundDrawing } from "@/app/landing/parts-drawings";
import { CARD_HEADER, PartRow, type Part } from "@/app/landing/parts-list";
import type { RoundScene, ScreenEllipse } from "@/app/landing/round-scene";
import { webglAvailable } from "@/app/landing/webgl";

// Hero + Round story: one scroll track. The hero and then the parts story sit on the left; the
// Round card stays pinned on the right while scrolling puts the Round together, then its screen
// comes on and can be tried. Spec: docs/specs/finished/handoff_landing_v2/README.md §2 and round-assembly.md.

type Step = null | 1 | 2 | 3 | "wake" | "try";

const CAPTIONS: Record<string, ReactNode> = {
  none: "Scroll to put it together",
  3: (
    <>
      <b className="font-normal text-filament">3</b> · Antenna clicks into the U.FL jack
    </>
  ),
  2: (
    <>
      <b className="font-normal text-filament">2</b> · Pin headers go through the XIAO
    </>
  ),
  1: (
    <>
      <b className="font-normal text-filament">1</b> · Round Display comes down onto the pins
    </>
  ),
  wake: "Screen wakes up…",
  try: (
    <>
      <b className="font-normal text-filament">→</b> Try it: touch the screen
    </>
  ),
};

function stepAt(p: number, tryMode: boolean): Step {
  if (tryMode) return "try";
  if (p < 0.08) return null;
  if (p < 0.36) return 3;
  if (p < 0.52) return 2;
  if (p < 0.78) return 1;
  return "wake";
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function RoundTrack({ hero, parts }: { hero: ReactNode; parts: Part[] }) {
  const trackRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLCanvasElement>(null);
  const shadeRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pulseRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const hitRef = useRef<HTMLDivElement>(null);
  const gesturesRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<RoundScene | null>(null);

  const [noGL, setNoGL] = useState(false);
  const [ready, setReady] = useState(false);
  const [p, setP] = useState(0);
  const [lit, setLit] = useState(false);
  const [tryMode, setTryMode] = useState(false);
  const [hinted, setHinted] = useState(false);
  const [openParts, setOpenParts] = useState<number[]>([]);
  const [r, setR] = useState<RoundState>({ page: 0, on: false, level: 64, scene: 0 });

  const pRef = useRef(0);
  const litRef = useRef(false);
  const litTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rRef = useRef(r);
  useEffect(() => {
    rRef.current = r;
    sceneRef.current?.setScreen(r);
  }, [r]);

  const clearTimers = () => {
    if (litTimer.current) clearTimeout(litTimer.current);
    if (tryTimer.current) clearTimeout(tryTimer.current);
    litTimer.current = tryTimer.current = null;
  };

  // Scroll → progress. Starts once the hero is half scrolled away (all of it on phones); the
  // animation uses 70% of what is left and the rest holds the live screen still.
  const onScroll = useCallback(() => {
    const track = trackRef.current, heroEl = heroRef.current, sticky = stickyRef.current;
    if (!track || !heroEl || !sticky) return;
    let np: number;
    if (reducedMotion()) np = 1;
    else {
      const narrow = window.matchMedia("(max-width: 860px)").matches;
      const heroH = heroEl.offsetHeight, start = narrow ? heroH : heroH * 0.5;
      const len = (track.offsetHeight - sticky.offsetHeight - start) * 0.7;
      np = len > 0 ? Math.max(0, Math.min(1, (-track.getBoundingClientRect().top - start) / len)) : 1;
    }
    if (np === pRef.current && sceneRef.current) return;
    pRef.current = np;
    setP(np);
    sceneRef.current?.setProgress(np);

    // Lights come on a moment after the screen settles, then Try-it starts; scrolling back
    // turns everything off again.
    const quick = reducedMotion();
    if (np >= 0.9 && !litRef.current && !litTimer.current) {
      litTimer.current = setTimeout(
        () => {
          litTimer.current = null;
          litRef.current = true;
          setLit(true);
          setR((v) => ({ ...v, on: true }));
          tryTimer.current = setTimeout(
            () => {
              tryTimer.current = null;
              setTryMode(true);
            },
            quick ? 0 : 450,
          );
        },
        quick ? 0 : 700,
      );
    }
    if (np < 0.86) {
      clearTimers();
      if (litRef.current) {
        litRef.current = false;
        setLit(false);
        setTryMode(false);
        setR((v) => ({ ...v, on: false }));
      }
    }
  }, []);

  useEffect(() => {
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    mq.addEventListener("change", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      mq.removeEventListener("change", onScroll);
      clearTimers();
    };
  }, [onScroll]);

  // Load three.js and build the scene. The card is on screen at first paint, so this starts
  // right after hydration; the card's grid alone covers the wait.
  useEffect(() => {
    if (!webglAvailable()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- WebGL support is only known in the browser
      setNoGL(true);
      return;
    }
    let alive = true;
    const onFrame = (s: ScreenEllipse) => {
      const pulse = pulseRef.current, hint = hintRef.current, hit = hitRef.current;
      if (pulse) Object.assign(pulse.style, { left: `${s.cx - s.rx}px`, top: `${s.cy - s.rx}px`, width: `${2 * s.rx}px`, height: `${2 * s.rx}px` });
      if (hint) Object.assign(hint.style, { left: `${s.cx}px`, top: `${Math.max(8, s.cy - s.rx - 44)}px` });
      if (hit) {
        const rx = s.rx * 1.08, ry = s.ry * 1.08;
        Object.assign(hit.style, { left: `${s.cx - rx}px`, top: `${s.cy - ry}px`, width: `${2 * rx}px`, height: `${2 * ry}px` });
      }
    };
    // Desktop lays the Try-it buttons over the drawing's bottom edge; phones put them below it.
    const bottomInset = () => {
      const g = gesturesRef.current;
      return g && getComputedStyle(g).position === "absolute" ? g.offsetHeight : 0;
    };
    const els = { area: areaRef.current!, line: lineRef.current!, shade: shadeRef.current!, grid: gridRef.current!, svg: svgRef.current! };
    import("@/app/landing/round-scene")
      .then((m) => m.createRoundScene(els, { onFrame, onFirstFrame: () => alive && setReady(true), bottomInset }))
      .then((scene) => {
        if (!alive) return scene.dispose();
        sceneRef.current = scene;
        scene.setScreen(rRef.current);
        scene.setProgress(pRef.current);
      })
      .catch(() => alive && setNoGL(true));
    const themeWatch = new MutationObserver(() => sceneRef.current?.applyTheme());
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      alive = false;
      themeWatch.disconnect();
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  // ---------- Try-it ----------
  const touched = () => setHinted(true);
  const rTap = () => {
    touched();
    setR((v) => ({ ...v, on: !v.on }));
  };
  const rScene = () => {
    touched();
    setR((v) => ({ ...v, on: true, scene: (v.scene + 1) % PAGES[v.page].scenes.length }));
  };
  const rLevel = (lv: number) => {
    touched();
    setR((v) => ({ ...v, level: lv, on: lv > 0 }));
  };
  const rDim = () => {
    touched();
    setR((v) => ({ ...v, on: true, level: v.level >= 90 ? 25 : Math.min(100, v.level + 25) }));
  };
  const rSwipe = (d: number) => {
    touched();
    setR((v) => ({ ...v, page: (v.page + d + PAGES.length) % PAGES.length, scene: 0, on: true }));
  };

  // Pointer gestures on the screen-sized hit element (touch-action: none only there, so a finger
  // anywhere else on the card still scrolls the page).
  const gesture = useRef<{ x: number; y: number; ring: boolean; moved: boolean } | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (tapTimer.current) clearTimeout(tapTimer.current);
  }, []);
  function down(e: PointerEvent<HTMLDivElement>) {
    const q = sceneRef.current?.screenPoint(e.clientX, e.clientY);
    if (!q || Math.hypot(q.dx, q.dy) > 0.56) return;
    const ring = Math.hypot(q.dx, q.dy) > 0.31;
    gesture.current = { x: e.clientX, y: e.clientY, ring, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (ring) rLevel(ringLevel(q.dx, q.dy));
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g) return;
    if (Math.abs(e.clientX - g.x) > 6 || Math.abs(e.clientY - g.y) > 6) g.moved = true;
    if (g.ring) {
      const q = sceneRef.current?.screenPoint(e.clientX, e.clientY);
      if (q) rLevel(ringLevel(q.dx, q.dy));
    }
  }
  function up(e: PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.ring) return;
    const dx = e.clientX - g.x;
    if (Math.abs(dx) > 30) return rSwipe(dx < 0 ? 1 : -1);
    if (g.moved) return;
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      rScene();
    } else {
      tapTimer.current = setTimeout(() => {
        tapTimer.current = null;
        rTap();
      }, DOUBLE_MS);
    }
  }

  const step = noGL ? null : stepAt(p, tryMode);
  const label = tryMode ? "Round · try it" : p < 0.6 ? "Round · exploded view" : "Round · assembled";
  const showHint = tryMode && !hinted;
  const page = PAGES[r.page];

  return (
    <section ref={trackRef} className="lv-track" data-flat={noGL ? "" : undefined}>
      <div className="min-w-0">
        <div ref={heroRef} className="lv-hero">
          {hero}
        </div>
        <div className="lv-story-wrap">
          <div className="lv-story">
            <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted">Round · 3 parts</span>
            <h3 className="text-balance text-[clamp(22px,2.2cqi,28px)] font-semibold leading-[1.15] tracking-[-0.02em]">
              A touch screen that snaps onto a XIAO.
            </h3>
            <ol className="flex flex-col border-t border-line">
              {parts.map((part, i) => (
                <PartRow
                  key={part.name}
                  n={String(i + 1)}
                  {...part}
                  active={step === i + 1 || step === "wake"}
                />
              ))}
              <PartRow
                n="→"
                name="Put it together"
                text="What to buy and how the three parts plug together, no soldering."
                href="/how-to?product=round&topic=build#assemble"
                linkLabel="Build guide →"
                dim={tryMode}
              />
              {noGL ? null : (
                <PartRow
                  n="→"
                  name="Try it"
                  text="Tap, double tap, drag the ring or swipe, right on the screen."
                  active={step === "try"}
                  dim={!tryMode}
                />
              )}
            </ol>
          </div>
        </div>
      </div>

      <div className="lv-card-col min-w-0">
        <div ref={stickyRef} className="lv-sticky">
          <article className="relative w-full overflow-hidden rounded-[20px] border border-line bg-cream">
            <div className={CARD_HEADER}>
              <span>{noGL ? "Round · exploded view" : label}</span>
              <span aria-live="polite" className={tryMode ? "normal-case tracking-normal" : undefined}>
                {tryMode ? roundReadout(r) : "mm"}
              </span>
            </div>
            {noGL ? (
              <div className="@container">
                <RoundDrawing />
              </div>
            ) : (
              <div ref={areaRef} className="lv-draw bg-cream">
                <div ref={gridRef} aria-hidden="true" className="lv-grid absolute inset-0" />
                <Room on={r.on} level={r.level} scene={page.scenes[r.scene]} hidden={!lit} lamp={false} />
                {/* Until the first WebGL frame the card shows only its grid (static, the same in
                    every frame), so nothing moves when the scene arrives: it fades in. */}
                <div aria-hidden="true" className={`lv-scene absolute inset-0${ready ? " lv-scene-ready" : ""}`}>
                  <canvas ref={lineRef} className="absolute inset-0 block h-full w-full" />
                  <canvas ref={shadeRef} className="absolute inset-0 block h-full w-full" style={{ opacity: 0 }} />
                  <svg
                    ref={svgRef}
                    className="pointer-events-none absolute inset-0 h-full w-full overflow-visible font-mono text-[13px] font-medium [&_text]:fill-foreground"
                  />
                </div>
                <div ref={pulseRef} aria-hidden="true" className={`lv-pulse ${showHint ? "opacity-100" : "opacity-0"}`} />
                <div
                  ref={hintRef}
                  aria-hidden="true"
                  className={`pointer-events-none absolute whitespace-nowrap rounded-full bg-filament px-3 py-[7px] font-mono text-xs font-medium text-filament-ink transition-[opacity,transform] duration-400 ${
                    showHint ? "-translate-x-1/2 opacity-100" : "-translate-x-1/2 translate-y-1.5 opacity-0"
                  }`}
                >
                  Touch the screen · it works
                </div>
                <div
                  aria-hidden="true"
                  className={`lv-scroll-hint pointer-events-none absolute bottom-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-line bg-cream px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-muted transition-opacity duration-300 ${
                    p < 0.02 ? "opacity-100" : "opacity-0"
                  }`}
                >
                  Scroll to put it together ↓
                </div>
                {/* Always mounted so every frame keeps it on the screen; live only in Try-it mode. */}
                <div
                  ref={hitRef}
                  aria-hidden="true"
                  onPointerDown={down}
                  onPointerMove={move}
                  onPointerUp={up}
                  onPointerCancel={() => {
                    gesture.current = null;
                  }}
                  className={`absolute touch-none select-none rounded-full ${tryMode ? "cursor-pointer" : "pointer-events-none"}`}
                />
              </div>
            )}
            {noGL ? null : (
              // Over the drawing's bottom edge on desktop; its own row under the drawing on phones (globals.css).
              <div ref={gesturesRef} inert={!tryMode} data-live={tryMode ? "" : undefined} className="lv-gestures p-3">
                <GesturePills
                  className="justify-center"
                  gestures={[
                    { gesture: "tap", action: "on / off", run: rTap },
                    { gesture: "double tap", action: "scenes", run: rScene },
                    { gesture: "drag the ring", action: "dim", run: rDim },
                    { gesture: "swipe", action: "next room", run: () => rSwipe(1) },
                  ]}
                />
              </div>
            )}
          </article>
          <p className="lv-caption min-h-[18px] text-center font-mono text-xs text-muted">
            {CAPTIONS[step === null ? "none" : String(step)]}
          </p>
          {/* Phones: the parts stay pinned under the card; the one being assembled gets the ring.
              Rows start closed; tapping a name opens its description. */}
          <article className="lv-phone-parts overflow-hidden rounded-[20px] border border-line bg-cream">
            <div className={CARD_HEADER}>
              <span>Round · 3 parts</span>
            </div>
            <ol className="flex flex-col">
              {parts.map((part, i) => (
                <PartRow
                  key={part.name}
                  n={String(i + 1)}
                  {...part}
                  active={step === i + 1 || step === "wake"}
                  open={openParts.includes(i)}
                  onToggle={() => setOpenParts((o) => (o.includes(i) ? o.filter((x) => x !== i) : [...o, i]))}
                />
              ))}
            </ol>
          </article>
        </div>
      </div>
    </section>
  );
}
