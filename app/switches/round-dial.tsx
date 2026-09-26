import { roundThemeById, type RoundTheme } from "@/lib/round-themes";

export function RoundDial({
  theme,
  name,
  scene,
  pageCount,
  activeIndex,
  on,
  size = 104,
}: {
  theme: string | RoundTheme;
  name: string;
  scene?: string | null;
  pageCount: number;
  activeIndex: number;
  on: boolean;
  size?: number;
}) {
  const palette = typeof theme === "string" ? roundThemeById(theme) : theme;
  const fill = on ? palette.fillOn : palette.fillOff;
  const ink = on ? palette.ink : palette.mute;
  const accent = on ? palette.accent : palette.track;
  const showScene = Boolean(on && scene);
  const dots = pageCount > 1 ? pageCount : 0;
  return (
    <div
      className="round-dial"
      style={{
        width: size,
        height: size,
        ["--t-bg" as string]: palette.bg,
        ["--t-ink" as string]: ink,
        ["--t-fill" as string]: fill,
        ["--t-accent" as string]: accent,
        ["--t-track" as string]: palette.track,
        ["--t-ring" as string]: accent,
        ["--k" as string]: size / 104,
      }}
      aria-hidden="true"
    >
      <div className="round-dial-bg" />
      <div className="round-dial-track" />
      <div className="round-dial-level" style={{ opacity: on ? 1 : 0.35 }} />
      <div className="round-dial-fill" />
      <div className="round-dial-copy">
        <div className="round-dial-name">{name || "Page"}</div>
        {showScene ? <div className="round-dial-scene">{scene}</div> : null}
      </div>
      {dots > 0 ? (
        <div className="round-dial-dots">
          {Array.from({ length: dots }, (_, index) => (
            <i key={index} className={index === activeIndex ? "on" : ""} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
