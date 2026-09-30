"use client";

import { useEffect, useState } from "react";
import { DEFAULT_THEME, THEMES, applyTheme, chooseTheme, currentTheme, type ThemeId } from "@/app/themes";

function SwatchGrid({
  title,
  items,
  theme,
  onChoose,
}: {
  title: string;
  items: (typeof THEMES)[number][];
  theme: ThemeId;
  onChoose: (id: ThemeId) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((item) => {
          const selected = item.id === theme;
          return (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onChoose(item.id)}
              className={`min-h-11 touch-manipulation rounded-xl border bg-cream p-3 text-left sm:p-2.5 ${
                selected
                  ? "border-filament shadow-[0_0_0_1px_var(--filament)]"
                  : "border-line"
              }`}
            >
              <span className="block text-sm font-medium">{item.name}</span>
              <span className="mt-0.5 block text-[11px] text-muted">{item.blurb}</span>
              <span className="mt-2 flex gap-1">
                {item.colors.map((color) => (
                  <i
                    key={color}
                    className="inline-block h-3.5 w-3.5 rounded-full border border-foreground/15"
                    style={{ background: color }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ThemePicker() {
  // Null until the stored theme is read: the server cannot know it, so the label stays hidden
  // instead of flashing the default's name over another theme.
  const [stored, setTheme] = useState<ThemeId | null>(null);
  const theme = stored ?? DEFAULT_THEME;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const id = currentTheme();
    // localStorage exists only after hydration; reading it in the initial state would mismatch the server render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(id);
    applyTheme(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-theme-picker]")) return;
      setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  function choose(id: ThemeId) {
    setTheme(id);
    chooseTheme(id);
  }

  const current = THEMES.find((item) => item.id === theme) ?? THEMES[0];
  const dark = THEMES.filter((item) => item.group === "dark");
  const light = THEMES.filter((item) => item.group === "light");

  return (
    <div className="relative" data-theme-picker>
      <button
        type="button"
        className="min-h-11 touch-manipulation rounded-md border border-line bg-cream px-3 py-1.5 text-sm text-foreground sm:min-h-0 sm:px-2.5 sm:py-1"
        aria-haspopup="dialog"
        aria-label={`Theme: ${current.name}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={stored ? undefined : "invisible"}>
          <span className="hidden sm:inline">Theme · </span>
          {current.name}
        </span>
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-foreground/40 md:hidden"
            aria-label="Close theme picker"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-2xl border-t border-line bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg md:absolute md:inset-auto md:right-0 md:top-full md:mt-2 md:max-h-[min(70vh,36rem)] md:w-[min(36rem,calc(100vw-2.5rem))] md:rounded-xl md:border md:p-3"
            role="dialog"
            aria-label="Choose theme"
          >
            <div className="mb-3 flex items-center justify-between md:hidden">
              <p className="text-sm font-medium">Theme</p>
              <button
                type="button"
                className="min-h-11 touch-manipulation rounded-md border border-line px-3 text-sm"
                onClick={() => setOpen(false)}
              >
                Done
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <SwatchGrid title="Dark" items={dark} theme={theme} onChoose={choose} />
              <SwatchGrid title="Light" items={light} theme={theme} onChoose={choose} />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
