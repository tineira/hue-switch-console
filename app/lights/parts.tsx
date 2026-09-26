// Pieces both Lights layouts share: marks, detail blocks, scene chips, the stale banner.
// Styles follow docs/specs/design_handoff_lights_map/.

import Link from "next/link";
import type { CSSProperties } from "react";
import {
  plural,
  staleText,
  switchColor,
  type Detail,
  type Line,
  type LightsModel,
  type MapSwitch,
  type Mark,
} from "@/lib/lights-map";

export function dotStyle(sw: MapSwitch, size: number): CSSProperties {
  return {
    display: "block",
    width: size,
    height: size,
    borderRadius: "50%",
    background: switchColor(sw),
    flexShrink: 0,
  };
}

export function ringStyle(sw: MapSwitch | null, size: number): CSSProperties {
  return {
    display: "block",
    width: size,
    height: size,
    borderRadius: "50%",
    border: `1.5px solid ${sw ? switchColor(sw) : "var(--muted)"}`,
    boxSizing: "border-box",
    flexShrink: 0,
  };
}

/** A Round page chip: filled when it controls the light, outlined when through a group. */
export function chipStyle(sw: MapSwitch, lineHeight: number, via = false): CSSProperties {
  const color = switchColor(sw);
  return {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    border: `1px solid ${color}`,
    background: via ? "transparent" : `color-mix(in oklch, ${color} 22%, transparent)`,
    color: "var(--foreground)",
    padding: "0 7px",
    fontSize: 11,
    fontWeight: 500,
    lineHeight: `${lineHeight}px`,
    whiteSpace: "nowrap",
    flexShrink: 0,
  };
}

/** Dots, rings and Round page chips. `size` is the dot size; rings follow the layout. */
export function Marks({
  marks,
  dot,
  ring,
  chipLine,
}: {
  marks: Mark[];
  dot: number;
  ring: number;
  chipLine: number;
}) {
  return (
    <>
      {marks.map((mark, index) =>
        mark.kind === "chip" ? (
          <span key={index} title={mark.title} style={chipStyle(mark.sw, chipLine, mark.via)}>
            {mark.label}
          </span>
        ) : (
          <i
            key={index}
            title={mark.title}
            style={mark.kind === "ring" ? ringStyle(mark.sw, ring) : dotStyle(mark.sw, dot)}
          />
        ),
      )}
    </>
  );
}

export function NoSwitchPill({ lineHeight }: { lineHeight?: number }) {
  return (
    <span
      title="No switch"
      className="rounded-full bg-warn-soft text-[11px] font-medium text-warn"
      style={{ padding: lineHeight ? "0 8px" : "0 7px", lineHeight: lineHeight ? `${lineHeight}px` : undefined }}
    >
      No switch
    </span>
  );
}

export function SceneOnlyRing({ size, title }: { size: number; title?: string }) {
  return <i title={title} style={ringStyle(null, size)} />;
}

const LABEL = "m-0 text-[11px] font-medium uppercase tracking-[0.12em] text-muted";

function LineText({
  line,
  size,
  muted,
  onSwitch,
}: {
  line: Line;
  size: number;
  muted?: boolean;
  onSwitch?: (id: string | null) => void;
}) {
  const dot = size === 8 ? 8 : 9;
  return (
    <p
      className={`m-0 text-pretty ${muted ? "text-muted" : ""}`}
      style={{ fontSize: size === 8 ? 13 : 14, lineHeight: size === 8 ? 1.45 : 1.5 }}
    >
      <i
        style={{
          display: "inline-block",
          width: dot,
          height: dot,
          borderRadius: "50%",
          background: switchColor(line.sw),
          marginRight: size === 8 ? 6 : 7,
          verticalAlign: "0.5px",
        }}
      />
      <span
        onMouseEnter={onSwitch ? () => onSwitch(line.sw.id) : undefined}
        onMouseLeave={onSwitch ? () => onSwitch(null) : undefined}
        className="font-medium text-foreground"
        style={
          onSwitch
            ? {
                textDecoration: "underline dotted",
                textDecorationColor: "var(--muted)",
                textUnderlineOffset: 3,
                cursor: "default",
              }
            : undefined
        }
      >
        {line.who}
      </span>{" "}
      · {line.what}
    </p>
  );
}

/**
 * Who controls it, its scenes and facts. Desktop (compact, dotted names that preview a
 * switch's reach) and mobile (14px) differ only in size.
 */
export function DetailBody({
  detail,
  compact,
  onSwitch,
}: {
  detail: Detail;
  compact: boolean;
  onSwitch?: (id: string | null) => void;
}) {
  const size = compact ? 8 : 9;
  return (
    <>
      {detail.blocks.map((block) => (
        <div key={block.label} className="flex flex-col" style={{ gap: compact ? 5 : 6 }}>
          <p className={LABEL}>{block.label}</p>
          {block.lines.map((line) => (
            <LineText key={line.who} line={line} size={size} onSwitch={onSwitch} />
          ))}
          {block.groups.map((group) => (
            <div key={group.name} className="flex flex-col gap-0.5">
              <p className="m-0 font-medium" style={{ fontSize: compact ? 13 : 14 }}>
                {group.name} <span className="font-normal text-muted">{group.kind}</span>
              </p>
              {group.lines.map((line) => (
                <LineText key={line.who} line={line} size={size} muted onSwitch={onSwitch} />
              ))}
            </div>
          ))}
        </div>
      ))}
      {detail.note ? (
        <p className="m-0 text-pretty" style={{ fontSize: compact ? 13 : 14, lineHeight: compact ? undefined : 1.5 }}>
          {detail.note}
        </p>
      ) : null}
      {detail.scenes.length > 0 ? (
        <div className="flex flex-col" style={{ gap: compact ? 5 : 6 }}>
          <p className={LABEL}>Scenes · {detail.scenes.length}</p>
          <div className="flex flex-wrap" style={{ gap: compact ? 4 : 6 }}>
            {detail.scenes.map((scene) => (
              <span
                key={scene.name}
                title={scene.title || undefined}
                className="inline-flex items-center rounded-full"
                style={{
                  gap: 5,
                  border: `1px solid ${scene.used ? "var(--muted)" : "var(--line)"}`,
                  padding: compact ? "1px 8px" : "3px 10px",
                  fontSize: compact ? 12 : 13,
                }}
              >
                {scene.name}
                {scene.sws.map((sw) => (
                  <i key={sw.id} style={dotStyle(sw, 7)} />
                ))}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

export function StaleBanner({ model, compact }: { model: LightsModel; compact: boolean }) {
  if (model.stale.length === 0) return null;
  const n = model.stale.length;
  return (
    <div
      role="status"
      className="flex flex-col border border-warn bg-warn-soft"
      style={{ borderRadius: compact ? 10 : 12, padding: compact ? "12px 16px" : "12px 14px", gap: compact ? 6 : 4 }}
    >
      <p className="m-0 text-sm font-medium text-warn">
        {plural(n, "gesture points", "gestures point")}{" "}
        {compact ? "at something that isn't in this snapshot" : "at something missing"}
      </p>
      {model.stale.map((g, index) =>
        compact ? (
          <p key={index} className="m-0 flex flex-wrap text-[13px] leading-[1.45]" style={{ gap: "2px 8px" }}>
            <span className="font-medium">
              {g.who} · {g.name}
            </span>
            <span>{staleText(g)}</span>
            <Link href={`/switches/${g.sw.id}`} className="text-filament underline-offset-2 hover:text-foreground">
              Fix in Switches
            </Link>
          </p>
        ) : (
          <p key={index} className="m-0 text-[13px] leading-[1.45]">
            <span className="font-medium">
              {g.who} · {g.name}
            </span>{" "}
            {staleText(g).replace(/ \([^)]*\)$/, ".")}
          </p>
        ),
      )}
      {compact ? (
        <p className="m-0 text-xs text-muted">
          It was probably deleted or re-created in the Hue app. If it is new, it shows up after
          the next check-in.
        </p>
      ) : (
        <Link
          href={`/switches/${model.stale[0].sw.id}`}
          className="py-1.5 text-[13px] text-filament"
        >
          Fix in Switches
        </Link>
      )}
    </div>
  );
}
