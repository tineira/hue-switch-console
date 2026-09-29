"use client";

import { useEffect, useRef, useState } from "react";
import { SIMPLE_SCENES, clamp } from "@/app/landing/demo-data";
import { GesturePills, Room, WallPlate, type SimpleState } from "@/app/landing/demo-parts";
import { CARD_HEADER, CARD_LABEL, PartsList, type Part } from "@/app/landing/parts-list";
import type { SimpleDrawing } from "@/app/landing/simple-render";
import { webglAvailable } from "@/app/landing/webgl";

// Simple card: parts and a try-it wall plate on the left, a still line drawing of the XIAO on
// the right. Spec: docs/specs/finished/handoff_landing_v2/README.md §3.

const W = 520;
const H = 440;

function Drawing() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [drawing, setDrawing] = useState<SimpleDrawing | null>(null);

  // Render only once the card is within about one viewport, then again on resize or theme change.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    let alive = true, near = false, timer: ReturnType<typeof setTimeout> | null = null;
    const render = () => {
      if (!near) return;
      const w = el.clientWidth, h = Math.round(H * Math.min(1, w / W));
      if (!w) return;
      import("@/app/landing/simple-render")
        .then((m) => {
          if (!alive) return;
          setSize({ w, h });
          setDrawing(m.renderSimpleDrawing(w, h));
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
  }, []);

  return (
    <div className="lv-grid flex flex-1 items-center [background-position:center]">
      <div
        ref={boxRef}
        aria-hidden="true"
        className="relative w-full overflow-hidden"
        style={{ height: size ? size.h : `min(${H}px, calc(100cqw * ${H} / ${W}))` }}
      >
        {drawing && size ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- a data URL rendered in the browser */}
            <img src={drawing.src} alt="" className="absolute inset-0 h-full w-full" />
            <svg
              viewBox={`0 0 ${size.w} ${size.h}`}
              className="absolute inset-0 h-full w-full overflow-visible font-mono text-xs"
              dangerouslySetInnerHTML={{ __html: drawing.overlay }}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

export function SimpleCard({ parts }: { parts: Part[] }) {
  // Without WebGL there is no drawing: the parts and the try-it column fill the card.
  const [gl, setGl] = useState(true);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- WebGL support is only known in the browser
    setGl(webglAvailable());
  }, []);
  const [s, setS] = useState<SimpleState>({ on: true, level: 92, scene: 1, holding: false, pulse: 0 });
  const level = useRef(s.level);
  const dir = useRef(1);
  const ramp = useRef<ReturnType<typeof setInterval> | null>(null);
  const rampEnd = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    level.current = s.level;
  }, [s.level]);
  useEffect(
    () => () => {
      if (ramp.current) clearInterval(ramp.current);
      if (rampEnd.current) clearTimeout(rampEnd.current);
    },
    [],
  );

  // Every event flashes the LED once.
  const event = (f: (v: SimpleState) => Partial<SimpleState>) => setS((v) => ({ ...v, ...f(v), pulse: v.pulse + 1 }));
  const click = () => event((v) => ({ on: !v.on, scene: v.on ? -1 : v.scene }));
  const scene = () => event((v) => ({ on: true, scene: (v.scene + 1) % SIMPLE_SCENES.length }));
  function holdStart() {
    // Like the switch: up first when the light is low, down otherwise.
    dir.current = level.current < 30 ? 1 : -1;
    event(() => ({ on: true, holding: true }));
    if (ramp.current) clearInterval(ramp.current);
    ramp.current = setInterval(() => {
      let l = level.current + dir.current * 3;
      if (l >= 100 || l <= 5) dir.current *= -1;
      l = clamp(l, 5, 100);
      level.current = l;
      setS((v) => ({ ...v, level: l }));
    }, 60);
  }
  function holdEnd() {
    if (ramp.current) clearInterval(ramp.current);
    ramp.current = null;
    setS((v) => ({ ...v, holding: false }));
  }
  function holdDemo() {
    if (rampEnd.current) clearTimeout(rampEnd.current);
    holdStart();
    rampEnd.current = setTimeout(holdEnd, 1100);
  }

  const sceneName = s.scene >= 0 ? SIMPLE_SCENES[s.scene] : null;

  return (
    <article
      className={`@container grid overflow-hidden rounded-[20px] border border-line bg-cream max-[860px]:grid-cols-1 ${
        gl ? "grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]" : "grid-cols-1"
      }`}
    >
      <div
        className={`flex min-w-0 flex-col max-[860px]:order-2 ${gl ? "max-[860px]:border-t max-[860px]:border-line" : ""}`}
      >
        <div className={CARD_HEADER}>
          <span>Simple · 1 part</span>
        </div>
        <PartsList parts={parts} />
        <div className={`${CARD_LABEL} mt-1 border-t border-line`}>
          <span>Simple · try it</span>
          <span aria-live="polite" className="normal-case tracking-normal">
            {`→ Hallway · ${s.on ? `${sceneName ? `${sceneName} · ` : ""}${s.level}%` : "off"}`}
          </span>
        </div>
        <div className="relative mx-[18px] flex h-[236px] items-center justify-center overflow-hidden rounded-2xl border border-line bg-background">
          <Room on={s.on} level={s.level} scene={sceneName} still={s.holding} />
          <div className="relative">
            <WallPlate state={s} onClick={click} onDouble={scene} onHoldStart={holdStart} onHoldEnd={holdEnd} />
          </div>
        </div>
        <GesturePills
          className="px-[18px] pb-[18px] pt-3"
          gestures={[
            { gesture: "click", action: "on / off", run: click },
            { gesture: "double-click", action: "scenes", run: scene },
            { gesture: "hold", action: "dim", run: holdDemo },
          ]}
        />
      </div>
      {gl ? (
        <div className="@container flex min-w-0 flex-col border-l border-line max-[860px]:border-l-0">
          <div className={CARD_HEADER}>
            <span>Simple</span>
            <span>mm</span>
          </div>
          <Drawing />
        </div>
      ) : null}
    </article>
  );
}
