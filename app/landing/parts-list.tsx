// Numbered parts list used by the Round story, the Round list on phones and the Simple card.
// No hooks, so server and client components can both render it.

// `href` is a shop by default; a site path ("/…") opens here, labelled by `linkLabel`.
export type Part = { name: string; text: string; href?: string; linkLabel?: string };

export const CARD_LABEL =
  "flex justify-between gap-3 px-[18px] py-3.5 font-mono text-[11px] uppercase tracking-[0.06em] text-muted";
export const CARD_HEADER = `${CARD_LABEL} border-b border-line`;

export function PartRow({
  n,
  name,
  text,
  href,
  linkLabel,
  active = false,
  dim = false,
  open = false,
  onToggle,
}: Part & { n: string; active?: boolean; dim?: boolean; open?: boolean; onToggle?: () => void }) {
  return (
    <li
      className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 border-b border-line px-[18px] py-3 transition-opacity duration-300 last:border-b-0"
      style={dim ? { opacity: 0.38 } : undefined}
    >
      <span
        className={`grid h-6 w-6 place-items-center rounded-full border-[1.5px] font-mono text-filament transition-colors duration-300 ${
          active ? "border-filament" : "border-transparent"
        } ${n === "→" ? "text-sm" : "text-[13px]"}`}
      >
        {n}
      </span>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
          {onToggle ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              className="flex cursor-pointer items-center gap-1.5 text-left text-[15px] font-semibold hover:text-filament"
            >
              {name}
              <span aria-hidden="true" className={`text-xs text-muted transition-transform duration-300 ${open ? "rotate-180" : ""}`}>
                ▾
              </span>
            </button>
          ) : (
            <span className="text-[15px] font-semibold">{name}</span>
          )}
          {href?.startsWith("/") ? (
            <a href={href} className="text-sm text-filament hover:underline">
              {linkLabel ?? "Guide →"}
            </a>
          ) : href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm text-filament hover:underline">
              {linkLabel ?? "seeedstudio.com ↗"}
            </a>
          ) : null}
        </div>
        {onToggle ? (
          <div className="lv-part-text" data-open={open ? "" : undefined}>
            <span className="text-sm leading-normal text-muted">{text}</span>
          </div>
        ) : (
          <span className="text-sm leading-normal text-muted">{text}</span>
        )}
      </div>
    </li>
  );
}

export function PartsList({ parts, className = "" }: { parts: Part[]; className?: string }) {
  return (
    <ol className={`flex flex-col ${className}`}>
      {parts.map((part, i) => (
        <PartRow key={part.name} n={String(i + 1)} {...part} />
      ))}
    </ol>
  );
}
