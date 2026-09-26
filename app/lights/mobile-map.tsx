"use client";

// Lights map, mobile (< 1024px): sticky search, switch chips, Rooms | Zones, bottom sheets.
// Port of `Lights map mobile.dc.html` (docs/specs/design_handoff_lights_map/).

import { useState } from "react";
import { SearchIcon } from "@/app/lights/desktop-map";
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
  roomShares,
  type LightsModel,
  type Mark,
} from "@/lib/lights-map";

const LABEL = "m-0 text-[11px] font-medium uppercase tracking-[0.12em] text-muted";

export function MobileMap({ model }: { model: LightsModel }) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"rooms" | "zones">("rooms");
  const [swSel, setSwSel] = useState<string | null>(null);
  const [sheet, setSheet] = useState<string[]>([]);

  const { rooms, zones, lights } = model;
  const swObj = swSel ? (model.switches.find((sw) => sw.id === swSel) ?? null) : null;
  const R = swObj ? reach(model, model.gestures.filter((g) => g.sw === swObj)) : null;
  const query = q.trim().toLowerCase();
  const has = (s: string) => s.toLowerCase().includes(query);
  const open = (key: string) => () => setSheet((stack) => [...stack, key]);

  const lightRow = (id: string) => {
    const light = lights[id];
    const lm = lightMarks(model, light);
    const on = R ? R.l.has(id) : false;
    return (
      <button
        key={id}
        type="button"
        onClick={open(`l:${id}`)}
        className="flex cursor-pointer items-center gap-2 border-0 text-left"
        style={{
          minHeight: 44,
          borderRadius: 9,
          background: on ? "var(--filament-soft)" : "transparent",
          opacity: R && !on ? 0.4 : 1,
          padding: "0 10px",
        }}
      >
        <span className="min-w-0 flex-1 truncate text-sm">{light.name}</span>
        {lm.length ? (
          <span className="inline-flex items-center gap-1">
            <Marks marks={lm} dot={9} ring={9} chipLine={17} />
          </span>
        ) : light.status === "via" ? (
          <SceneOnlyRing size={9} />
        ) : null}
        {light.status === "none" ? <NoSwitchPill lineHeight={18} /> : null}
      </button>
    );
  };

  const roomList = rooms.filter(
    (room) =>
      (!R || room.lights.some((id) => R.l.has(id))) &&
      (!query || has(room.name) || room.lights.some((id) => has(lights[id].name))),
  );
  const zoneList = zones.filter(
    (zone) =>
      (!R || zone.lights.some((id) => R.l.has(id))) &&
      (!query || has(zone.name) || zone.lights.some((id) => has(lights[id].name))),
  );
  const named = model.switches.find((sw) => sw.named) ?? null;
  const shown = tab === "rooms" ? roomList : zoneList;

  return (
    <div className="flex flex-col">
      <div
        className="sticky top-0 z-[3] -mx-5 flex flex-col border-b border-line bg-background"
        style={{ gap: 10, padding: "4px 20px 12px" }}
      >
        <label
          className="flex items-center gap-2 border border-line bg-cream"
          style={{ minHeight: 44, borderRadius: 10, padding: "0 12px" }}
        >
          <SearchIcon size={16} />
          <input
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Find a light, room or zone"
            aria-label="Search"
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-base outline-none placeholder:text-muted"
          />
        </label>
        {model.switches.length > 0 ? (
          <div
            className="-mx-5 flex gap-2 overflow-x-auto px-5"
            style={{ scrollbarWidth: "none" }}
          >
            {model.switches.map((sw) => {
              const pinned = swSel === sw.id;
              return (
                <button
                  key={sw.id}
                  type="button"
                  aria-pressed={pinned}
                  onClick={() => setSwSel(pinned ? null : sw.id)}
                  className="flex shrink-0 cursor-pointer items-center whitespace-nowrap rounded-full text-sm"
                  style={{
                    gap: 7,
                    minHeight: 40,
                    border: `1px solid ${pinned ? "var(--filament)" : "var(--line)"}`,
                    background: pinned ? "var(--filament-soft)" : "var(--cream)",
                    boxShadow: pinned ? "0 0 0 1px var(--filament)" : "none",
                    padding: "0 14px 0 12px",
                  }}
                >
                  <i style={dotStyle(sw, 10)} />
                  <span>{sw.name}</span>
                </button>
              );
            })}
          </div>
        ) : null}
        {swObj && R ? (
          <div className="flex items-center gap-2 text-[13px]">
            <span className="min-w-0 flex-1 text-pretty text-muted">
              {swObj.name} reaches {plural(R.l.size, "light")} in {plural(roomList.length, "room")}
            </span>
            <button
              type="button"
              onClick={() => setSwSel(null)}
              className="cursor-pointer border-0 bg-transparent px-1 text-[13px] font-medium text-filament"
              style={{ minHeight: 36 }}
            >
              Show all
            </button>
          </div>
        ) : null}
        <div
          role="tablist"
          className="grid grid-cols-2 gap-1 border border-line bg-cream"
          style={{ borderRadius: 10, padding: 3 }}
        >
          {(
            [
              ["rooms", `Rooms · ${roomList.length}`],
              ["zones", `Zones · ${zoneList.length}`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className="cursor-pointer border-0 text-sm font-medium"
              style={{
                minHeight: 38,
                borderRadius: 8,
                background: tab === key ? "var(--background)" : "transparent",
                boxShadow: tab === key ? "0 1px 2px rgb(0 0 0 / 15%)" : "none",
                color: tab === key ? "var(--foreground)" : "var(--muted)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col" style={{ gap: 10, padding: "12px 0 24px" }}>
        {tab === "rooms"
          ? roomList.map((room) => {
              const lit = R ? R.lit.has(room.key) : false;
              const ctrl = marks(model.groupCtl[room.key] ?? []);
              return (
                <div
                  key={room.key}
                  className="overflow-hidden border bg-cream"
                  style={{ borderRadius: 14, borderColor: lit ? "var(--filament)" : "var(--line)" }}
                >
                  <button
                    type="button"
                    onClick={open(room.key)}
                    className="flex w-full cursor-pointer items-start border-0 text-left"
                    style={{
                      gap: 10,
                      background: lit ? "var(--filament-soft)" : "transparent",
                      padding: "12px 14px",
                    }}
                  >
                    <GroupHeading
                      name={room.name}
                      meta={`${plural(room.lights.length, "light")} · ${plural(room.scenes.length, "scene")}`}
                      ctrl={ctrl}
                    />
                    <Chevron />
                  </button>
                  <div className="flex flex-col border-t border-line p-1">
                    {room.lights
                      .filter((id) => !query || has(room.name) || has(lights[id].name))
                      .map(lightRow)}
                  </div>
                </div>
              );
            })
          : zoneList.map((zone) => {
              const lit = R ? R.lit.has(zone.key) : false;
              const got = R ? zone.lights.filter((id) => R.l.has(id)).length : 0;
              const ctrl = marks(model.groupCtl[zone.key] ?? []);
              return (
                <button
                  key={zone.key}
                  type="button"
                  onClick={open(zone.key)}
                  className="flex cursor-pointer items-start border text-left"
                  style={{
                    gap: 10,
                    borderRadius: 14,
                    borderColor: lit ? "var(--filament)" : "var(--line)",
                    background: lit ? "var(--filament-soft)" : "var(--cream)",
                    padding: "12px 14px",
                  }}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 text-[15px] font-medium">{zone.name}</span>
                      <span className="font-mono text-xs text-muted">
                        {zone.all ? `all ${zone.lights.length}` : zone.lights.length}
                      </span>
                    </span>
                    <MarksOrNone ctrl={ctrl} />
                    {R && !lit ? (
                      <span className="text-xs text-foreground">
                        {got} of {zone.lights.length} lights reached
                      </span>
                    ) : null}
                  </span>
                  <Chevron />
                </button>
              );
            })}

        {shown.length === 0 ? (
          <p className="my-3 text-center text-sm text-muted">Nothing matches.</p>
        ) : null}

        <div
          className="mt-2 flex flex-col gap-2 border border-line text-xs text-muted"
          style={{ borderRadius: 12, padding: "12px 14px" }}
        >
          <span className="flex items-center gap-2">
            <span className="inline-flex" style={{ gap: 3 }}>
              {model.switches.slice(0, 4).map((sw) => (
                <i key={sw.id} style={dotStyle(sw, 8)} />
              ))}
            </span>
            switch controls it directly, or the whole room or zone
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-flex" style={{ gap: 3 }}>
              {model.switches.slice(0, 4).map((sw) => (
                <i key={sw.id} style={ringStyle(sw, 9)} />
              ))}
            </span>
            reaches the light through its room or a zone
          </span>
          {named ? (
            <span className="flex items-center gap-2">
              <span className="inline-flex" style={{ gap: 3 }}>
                <span style={chipStyle(named, 17)}>Page</span>
                <span style={chipStyle(named, 17, true)}>Page</span>
              </span>
              a page on a Round: filled when it controls it, outlined through its room or a zone
            </span>
          ) : null}
          <span className="flex items-center gap-2">
            <SceneOnlyRing size={9} />
            only scenes, through its room or a zone
          </span>
        </div>
      </div>

      {sheet.length > 0 ? (
        <Sheet
          model={model}
          top={sheet[sheet.length - 1]}
          canBack={sheet.length > 1}
          onBack={() => setSheet((stack) => stack.slice(0, -1))}
          onClose={() => setSheet([])}
          open={(key) => setSheet((stack) => [...stack, key])}
          lightRow={lightRow}
        />
      ) : null}
    </div>
  );
}

function GroupHeading({ name, meta, ctrl }: { name: string; meta: string; ctrl: Mark[] }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-[15px] font-medium">{name}</span>
      <span className="text-xs text-muted">{meta}</span>
      <MarksOrNone ctrl={ctrl} />
    </span>
  );
}

function MarksOrNone({ ctrl }: { ctrl: Mark[] }) {
  return ctrl.length ? (
    <span className="flex flex-wrap items-center pt-0.5" style={{ gap: 5 }}>
      <Marks marks={ctrl} dot={9} ring={9} chipLine={17} />
    </span>
  ) : (
    <span className="text-xs text-muted">No switch of its own</span>
  );
}

function Chevron({ back }: { back?: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={back ? 20 : 18}
      height={back ? 20 : 18}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
      className={back ? "" : "mt-0.5 shrink-0 text-muted"}
    >
      <path d={back ? "m12 5-5 5 5 5" : "m8 5 5 5-5 5"} />
    </svg>
  );
}

function Sheet({
  model,
  top,
  canBack,
  onBack,
  onClose,
  open,
  lightRow,
}: {
  model: LightsModel;
  top: string;
  canBack: boolean;
  onBack: () => void;
  onClose: () => void;
  open: (key: string) => void;
  lightRow: (id: string) => React.ReactNode;
}) {
  const isLight = top.startsWith("l:");
  const light = isLight ? model.lights[top.slice(2)] : null;
  const group = isLight ? null : model.gmap[top];
  if (!light && !group) return null;

  const title = light ? light.name : group!.name;
  const kind = light
    ? `Light · ${light.color ? "Colour" : "White"} · ${light.on ? "On" : "Off"} at snapshot`
    : `${group!.type === "room" ? "Room" : "Zone"} · ${plural(group!.lights.length, "light")}${group!.all ? ", every light on the Bridge" : ""}`;
  const sheetMarks = light ? lightMarks(model, light) : marks(model.groupCtl[group!.key] ?? []);
  const detail = light ? lightDetail(model, light) : groupDetail(model, group!);
  const links = light
    ? [
        { label: "Room", items: [light.room] },
        ...(light.zones.length ? [{ label: `Zones · ${light.zones.length}`, items: light.zones }] : []),
      ]
    : [];
  const lightGroups = group
    ? group.type === "room"
      ? [{ label: `Lights · ${group.lights.length}`, ids: group.lights }]
      : roomShares(model, group).map(({ room, ids, count }) => ({
          label: count === room.lights.length ? `All of ${room.name}` : `${count} of ${room.lights.length} in ${room.name}`,
          ids,
        }))
    : [];

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40" style={{ background: "rgb(0 0 0 / 40%)" }} />
      <div
        role="dialog"
        aria-label={title}
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col border-t border-line bg-background"
        style={{ maxHeight: "82vh", borderRadius: "22px 22px 0 0", boxShadow: "0 -10px 40px rgb(0 0 0 / 25%)" }}
      >
        <div className="flex justify-center" style={{ padding: "8px 0 2px" }}>
          <i className="block bg-line" style={{ width: 36, height: 5, borderRadius: 3 }} />
        </div>
        <div className="flex items-start gap-1" style={{ padding: "4px 8px 10px" }}>
          {canBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent"
            >
              <Chevron back />
            </button>
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col gap-1" style={{ padding: "6px 8px 0" }}>
            <p className="m-0 text-lg font-semibold tracking-[-0.01em]">{title}</p>
            <p className="m-0 text-[13px] text-muted">{kind}</p>
            {sheetMarks.length ? (
              <span className="flex flex-wrap items-center pt-0.5" style={{ gap: 5 }}>
                <Marks marks={sheetMarks} dot={9} ring={9} chipLine={17} />
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent"
          >
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="m5 5 10 10M15 5 5 15" />
            </svg>
          </button>
        </div>
        <div className="flex flex-col overflow-y-auto" style={{ gap: 16, padding: "4px 16px 28px" }}>
          {links.map((link) => (
            <div key={link.label} className="flex flex-col" style={{ gap: 6 }}>
              <p className={LABEL}>{link.label}</p>
              <div className="flex flex-wrap" style={{ gap: 6 }}>
                {link.items.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => open(key)}
                    className="flex cursor-pointer items-center rounded-full border border-line bg-cream text-sm"
                    style={{ gap: 6, minHeight: 36, padding: "0 12px" }}
                  >
                    {model.gmap[key].name}
                    <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="text-muted">
                      <path d="m8 5 5 5-5 5" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <DetailBody detail={{ ...detail, scenes: light ? [] : detail.scenes }} compact={false} />
          {lightGroups.map((lg) => (
            <div key={lg.label} className="flex flex-col gap-0.5">
              <p className={`${LABEL} mb-1`}>{lg.label}</p>
              <div className="flex flex-col border border-line bg-cream p-1" style={{ borderRadius: 12 }}>
                {lg.ids.map(lightRow)}
              </div>
            </div>
          ))}
          {light && !light.zones.length ? <p className="m-0 text-[13px] text-muted">In no zone</p> : null}
        </div>
      </div>
    </>
  );
}
