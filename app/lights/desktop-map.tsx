"use client";

// Lights map, desktop (≥ 1024px): rooms and lights | connectors | zones.
// Port of `Lights map desktop.dc.html` (docs/specs/finished/design_handoff_lights_map/).

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  chipStyle,
  DetailBody,
  dotStyle,
  Marks,
  NoSwitchPill,
  ringStyle,
  SceneOnlyRing,
} from "@/app/lights/parts";
import {
  groupDetail,
  lightDetail,
  lightMarks,
  marks,
  plural,
  reach,
  type LightsModel,
  type MapLight,
  type Reach,
} from "@/lib/lights-map";

type Link = [from: string, to: string, opacity: number];
type Drawn = { paths: { d: string; o: number }[]; dots: { x: string; y: string }[] };

const SECTION_LABEL = "m-0 text-[11px] font-medium uppercase tracking-[0.12em] text-muted";
const lightKey = (id: string) => `l:${id}`;

function nodeStyle(on: boolean, strong: boolean) {
  return {
    borderColor: strong || on ? "var(--filament)" : "var(--line)",
    background: strong ? "var(--filament-soft)" : "var(--cream)",
    boxShadow: strong ? "0 0 0 1px var(--filament)" : "none",
  };
}

export function DesktopMap({ model }: { model: LightsModel }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [swHover, setSwHover] = useState<string | null>(null);
  const [swSel, setSwSel] = useState<string | null>(null);
  const [drawn, setDrawn] = useState<Drawn>({ paths: [], dots: [] });
  const mapRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<Link[]>([]);
  const lastKey = useRef("");
  const raf = useRef(0);

  const { rooms, zones, lights } = model;
  const nLights = Object.keys(lights).length;
  const query = q.trim().toLowerCase();
  const has = (s: string) => s.toLowerCase().includes(query);

  // What drives highlight and connectors: a hovered or pinned switch, else the open or
  // hovered node. With a switch shown, a hovered or open node still draws its connectors.
  const { rel, links, focus, act, swObj } = useMemo(() => {
    const empty = (): Reach => ({ l: new Set(), g: new Set(), lit: new Set() });
    let rel = empty();
    const links: Link[] = [];
    const swId = swHover ?? swSel;
    const swObj = swId ? (model.switches.find((sw) => sw.id === swId) ?? null) : null;
    const act = swObj ? null : (sel ?? hover);
    if (swObj) rel = reach(model, model.gestures.filter((g) => g.sw === swObj));
    const lk = swObj ? (hover ?? sel) : act;
    if (lk) {
      const keep = swObj ? rel : null;
      if (keep) rel = empty();
      if (lk.startsWith("l:")) {
        const light = lights[lk.slice(2)];
        rel.l.add(light.id);
        rel.g.add(light.room);
        for (const zone of light.zones) {
          rel.g.add(zone);
          links.push([lk, zone, 0.9]);
        }
      } else {
        const group = model.gmap[lk];
        rel.g.add(lk);
        for (const id of group.lights) rel.l.add(id);
        if (group.type === "zone") {
          for (const id of group.lights) {
            rel.g.add(lights[id].room);
            links.push([lightKey(id), lk, group.lights.length > 20 ? 0.45 : 0.8]);
          }
        } else {
          for (const zone of zones) {
            const shared = group.lights.filter((id) => zone.lights.includes(id));
            if (!shared.length) continue;
            rel.g.add(zone.key);
            for (const id of shared) links.push([lightKey(id), zone.key, zone.lights.length > 20 ? 0.35 : 0.8]);
          }
        }
      }
      if (keep) rel = keep;
    }
    return { rel, links, focus: Boolean(swObj || act), act, swObj };
  }, [model, lights, zones, sel, hover, swHover, swSel]);

  const measure = useCallback(() => {
    const root = mapRef.current;
    if (!root) return;
    const R = root.getBoundingClientRect();
    const find = (key: string) => root.querySelector(`[data-node="${CSS.escape(key)}"]`);
    const paths: Drawn["paths"] = [];
    const dots: Drawn["dots"] = [];
    for (const [from, to, o] of linksRef.current) {
      const A = find(from);
      const B = find(to);
      if (!A || !B) continue;
      const a = A.getBoundingClientRect();
      const b = B.getBoundingClientRect();
      const left = b.left + b.width / 2 < a.left;
      const x1 = (left ? a.left : a.right) - R.left;
      const y1 = a.top + a.height / 2 - R.top;
      const x2 = (left ? b.right : b.left) - R.left;
      const y2 = b.top + b.height / 2 - R.top;
      const dx = Math.max(40, Math.abs(x2 - x1) * 0.5) * (left ? -1 : 1);
      paths.push({
        d: `M${x1.toFixed(1)} ${y1.toFixed(1)} C${(x1 + dx).toFixed(1)} ${y1.toFixed(1)}, ${(x2 - dx).toFixed(1)} ${y2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`,
        o,
      });
      dots.push({ x: x1.toFixed(1), y: y1.toFixed(1) }, { x: x2.toFixed(1), y: y2.toFixed(1) });
    }
    const key = JSON.stringify(paths);
    if (key !== lastKey.current) {
      lastKey.current = key;
      setDrawn({ paths, dots });
    }
  }, []);

  const schedule = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(measure);
  }, [measure]);

  // Recompute connectors on every update, scroll and resize.
  useEffect(() => {
    linksRef.current = links;
    schedule();
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSel(null);
      setSwHover(null);
      setSwSel(null);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("keydown", onKey);
    };
  }, [schedule]);

  const passes = (light: MapLight) =>
    !query ||
    has(light.name) ||
    has(model.gmap[light.room].name) ||
    light.zones.some((key) => has(model.gmap[key].name));
  const hoverOf = (key: string) => () => {
    if (!sel && hover !== key) setHover(key);
  };
  const pick = (key: string) => (event: MouseEvent) => {
    event.stopPropagation();
    setSel(sel === key ? null : key);
    setHover(null);
    setSwHover(null);
  };
  const onSwitch = (id: string | null) => setSwHover(id);
  const named = model.switches.find((sw) => sw.named) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center" style={{ gap: "10px 12px" }}>
        <label
          className="flex items-center gap-2 rounded-md border border-line bg-cream"
          style={{ flex: "0 1 320px", padding: "5px 10px" }}
        >
          <SearchIcon size={15} />
          <input
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Find a light, room or zone"
            aria-label="Search"
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-muted"
          />
        </label>
        {model.switches.length > 0 ? (
          <span className="ml-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
            Switches
          </span>
        ) : null}
        {model.switches.map((sw) => {
          const R = reach(model, model.gestures.filter((g) => g.sw === sw));
          const pinned = swSel === sw.id;
          const shown = swObj === sw;
          const hits = act ? (act.startsWith("l:") ? R.l.has(act.slice(2)) : R.lit.has(act)) : false;
          return (
            <button
              key={sw.id}
              type="button"
              aria-pressed={pinned}
              title={`${sw.product} · reaches ${plural(R.l.size, "light")} · ${sw.meta}`}
              onClick={() => {
                setSwSel(pinned ? null : sw.id);
                setSel(null);
                setHover(null);
              }}
              onMouseEnter={() => setSwHover(sw.id)}
              onMouseLeave={() => setSwHover(null)}
              className="flex cursor-pointer items-center rounded-full text-[13px]"
              style={{
                gap: 7,
                border: `1px solid ${pinned || shown || hits ? "var(--filament)" : "var(--line)"}`,
                background: pinned || hits ? "var(--filament-soft)" : "var(--cream)",
                boxShadow: pinned ? "0 0 0 1px var(--filament)" : "none",
                opacity: (act && !hits) || (swObj && !shown) ? 0.45 : 1,
                padding: "4px 12px 4px 10px",
                transition: "opacity .12s, border-color .12s",
              }}
            >
              <i style={dotStyle(sw, 10)} />
              <span>{sw.name}</span>
            </button>
          );
        })}
      </div>

      <section className="flex flex-col" style={{ gap: 10 }}>
        <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) 120px 320px" }}>
          <div className="grid" style={{ gridTemplateColumns: "250px minmax(0,1fr)" }}>
            <p className={SECTION_LABEL}>Rooms · {rooms.length}</p>
            <p className={SECTION_LABEL} style={{ paddingLeft: 16 }}>
              Lights · {nLights}
            </p>
          </div>
          <span />
          <p className={SECTION_LABEL}>Zones · {zones.length}</p>
        </div>

        <div
          ref={mapRef}
          onMouseLeave={() => setHover(null)}
          onClick={(event) => {
            const target = event.target as Element;
            if (!target.closest("[data-node]") && !target.closest("[data-detail]")) setSel(null);
          }}
          className="relative grid items-start"
          style={{ gridTemplateColumns: "minmax(0,1fr) 120px 320px" }}
        >
          <div className="flex flex-col" style={{ gap: 10 }}>
            {rooms.map((room) => {
              const on = focus && rel.g.has(room.key);
              const open = sel === room.key;
              const strong = open || (!sel && hover === room.key) || rel.lit.has(room.key);
              const style = nodeStyle(on, strong);
              const ctrl = marks(model.groupCtl[room.key] ?? []);
              return (
                <div
                  key={room.key}
                  className="grid rounded-[10px] border"
                  style={{
                    gridTemplateColumns: "250px minmax(0,1fr)",
                    borderColor: style.borderColor,
                    background: "var(--cream)",
                    boxShadow: style.boxShadow,
                    opacity: (focus && !on) || !room.lights.some((id) => passes(lights[id])) ? 0.4 : 1,
                  }}
                >
                  <div
                    className="flex flex-col self-stretch border-r border-line"
                    style={{ borderRadius: "9px 0 0 9px", background: style.background }}
                  >
                    <button
                      type="button"
                      data-node={room.key}
                      onClick={pick(room.key)}
                      onMouseEnter={hoverOf(room.key)}
                      aria-expanded={open}
                      className="flex cursor-pointer flex-col items-start gap-1 rounded-[10px] border-0 bg-transparent text-left"
                      style={{ padding: "10px 12px" }}
                    >
                      <span className="text-sm font-medium">{room.name}</span>
                      <span className="text-xs text-muted">
                        {plural(room.lights.length, "light")} · {plural(room.scenes.length, "scene")}
                      </span>
                      {ctrl.length ? (
                        <span className="flex flex-wrap pt-0.5" style={{ gap: 5 }}>
                          <Marks marks={ctrl} dot={9} ring={8} chipLine={16} />
                        </span>
                      ) : (
                        <span className="text-xs text-muted">No switch of its own</span>
                      )}
                    </button>
                    {open ? (
                      <div
                        data-detail="1"
                        className="flex flex-col border-t border-line"
                        style={{ gap: 10, padding: "10px 12px 12px" }}
                      >
                        <DetailBody detail={groupDetail(model, room)} compact onSwitch={onSwitch} />
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-0.5 p-1">
                    {room.lights.map((id) => {
                      const light = lights[id];
                      const key = lightKey(id);
                      const lopen = sel === key;
                      const strongL = lopen || (!sel && hover === key) || rel.lit.has(id);
                      const lm = lightMarks(model, light);
                      const detail = lopen ? lightDetail(model, light) : null;
                      return (
                        <div
                          key={id}
                          className="flex flex-col rounded-md border"
                          style={{
                            borderColor: strongL ? "var(--filament)" : "transparent",
                            background: lopen
                              ? "var(--background)"
                              : strongL
                                ? "var(--filament-soft)"
                                : focus && rel.l.has(id)
                                  ? "var(--cream)"
                                  : "transparent",
                            opacity: (focus && !rel.l.has(id)) || !passes(light) ? 0.35 : 1,
                          }}
                        >
                          <button
                            type="button"
                            data-node={key}
                            onClick={pick(key)}
                            onMouseEnter={hoverOf(key)}
                            aria-expanded={lopen}
                            className="flex cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent text-left"
                            style={{ minHeight: 30, padding: "3px 6px 3px 10px" }}
                          >
                            <span
                              className="min-w-0 flex-1 truncate text-[13px]"
                              style={{ fontWeight: lopen ? 500 : 400 }}
                            >
                              {light.name}
                            </span>
                            {lm.length ? (
                              <span className="inline-flex items-center" style={{ gap: 3, padding: "0 3px" }}>
                                <Marks marks={lm} dot={8} ring={8} chipLine={16} />
                              </span>
                            ) : light.status === "via" ? (
                              <span style={{ margin: "0 5px" }}>
                                <SceneOnlyRing
                                  size={8}
                                  title={`Through ${light.viaGroups.map((key) => model.gmap[key].name).join(", ")}`}
                                />
                              </span>
                            ) : null}
                            {light.status === "none" ? <NoSwitchPill /> : null}
                          </button>
                          {detail ? (
                            <div
                              data-detail="1"
                              className="flex flex-col"
                              style={{ gap: 10, padding: "4px 10px 10px" }}
                            >
                              <DetailBody detail={detail} compact onSwitch={onSwitch} />
                              {detail.facts ? (
                                <p className="m-0 text-pretty text-xs leading-normal text-muted">{detail.facts}</p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <span />

          <div
            onScroll={schedule}
            className="sticky flex flex-col overflow-y-auto"
            style={{ top: 16, maxHeight: "calc(100vh - 32px)", gap: 6 }}
          >
            {zones.map((zone) => {
              const on = focus && rel.g.has(zone.key);
              const open = sel === zone.key;
              const strong = open || (!sel && hover === zone.key) || rel.lit.has(zone.key);
              const style = nodeStyle(on, strong);
              const ctrl = marks(model.groupCtl[zone.key] ?? []);
              const detail = open ? groupDetail(model, zone) : null;
              return (
                <div
                  key={zone.key}
                  className="flex shrink-0 flex-col rounded-[10px] border"
                  style={{
                    ...style,
                    opacity:
                      (focus && !on) ||
                      (query && !has(zone.name) && !zone.lights.some((id) => has(lights[id].name)))
                        ? 0.4
                        : 1,
                  }}
                >
                  <button
                    type="button"
                    data-node={zone.key}
                    onClick={pick(zone.key)}
                    onMouseEnter={hoverOf(zone.key)}
                    aria-expanded={open}
                    className="flex cursor-pointer flex-col items-start gap-0.5 rounded-[10px] border-0 bg-transparent text-left"
                    style={{ padding: "7px 12px" }}
                  >
                    <span className="flex w-full items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{zone.name}</span>
                      <span className="font-mono text-xs text-muted">
                        {zone.all ? `all ${zone.lights.length}` : zone.lights.length}
                      </span>
                    </span>
                    {ctrl.length ? (
                      <span className="flex flex-wrap pt-0.5" style={{ gap: 5 }}>
                        <Marks marks={ctrl} dot={9} ring={8} chipLine={16} />
                      </span>
                    ) : (
                      <span className="text-xs text-muted">No switch of its own</span>
                    )}
                  </button>
                  {detail ? (
                    <div
                      data-detail="1"
                      className="flex flex-col border-t border-line"
                      style={{ gap: 10, padding: "10px 12px 12px" }}
                    >
                      <DetailBody detail={detail} compact onSwitch={onSwitch} />
                      {detail.facts ? (
                        <p className="m-0 text-pretty text-xs leading-normal text-muted">{detail.facts}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {zones.length === 0 ? <p className="m-0 text-[13px] text-muted">No zones on this Bridge.</p> : null}
          </div>

          <svg
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 h-full w-full overflow-visible"
          >
            {drawn.paths.map((path, index) => (
              <path
                key={index}
                d={path.d}
                fill="none"
                style={{ stroke: "var(--filament)", strokeWidth: 1.5, strokeOpacity: path.o }}
              />
            ))}
            {drawn.dots.map((dot, index) => (
              <circle key={index} cx={dot.x} cy={dot.y} r={3} style={{ fill: "var(--filament)" }} />
            ))}
          </svg>
        </div>

        <div className="flex flex-wrap items-center pt-2 text-xs text-muted" style={{ gap: "6px 18px" }}>
          <LegendItem mark={<LegendDots model={model} ring={false} />}>
            switches that control the light directly
          </LegendItem>
          <LegendItem mark={<LegendDots model={model} ring />}>
            switches that reach it through its room or a zone
          </LegendItem>
          {named ? (
            <LegendItem
              mark={
                <span className="inline-flex" style={{ gap: 3 }}>
                  <span style={chipStyle(named, 16)}>Page</span>
                  <span style={chipStyle(named, 16, true)}>Page</span>
                </span>
              }
            >
              a page on a Round: filled when it controls it, outlined through its room or a zone
            </LegendItem>
          ) : null}
          <LegendItem mark={<SceneOnlyRing size={8} />}>only scenes, through its room or a zone</LegendItem>
          <LegendItem mark={<NoSwitchPill />}>nothing reaches it</LegendItem>
          <LegendItem mark={<LegendDots model={model} ring={false} />}>
            switches that control the room or zone as a whole, or cycle its scenes
          </LegendItem>
          <span className="ml-auto">
            Hover to preview · click to open · Esc to close · hover or click a switch to see its reach
          </span>
        </div>
      </section>
    </div>
  );
}

function LegendItem({ mark, children }: { mark: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {mark}
      {children}
    </span>
  );
}

function LegendDots({ model, ring }: { model: LightsModel; ring: boolean }) {
  return (
    <span className="inline-flex" style={{ gap: 3 }}>
      {model.switches.slice(0, 4).map((sw) => (
        <i key={sw.id} style={ring ? ringStyle(sw, 8) : dotStyle(sw, 7)} />
      ))}
    </span>
  );
}

export function SearchIcon({ size }: { size: number }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
      className="shrink-0 text-muted"
    >
      <circle cx="9" cy="9" r="5.5" />
      <path d="m13.2 13.2 3.6 3.6" strokeLinecap="round" />
    </svg>
  );
}
