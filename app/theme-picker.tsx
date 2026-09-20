"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  THEMES,
  isThemeId,
  type ThemeId,
} from "@/app/themes";

function applyTheme(id: ThemeId) {
  document.documentElement.setAttribute("data-theme", id);
}

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
              className={`rounded-xl border bg-cream p-2.5 text-left ${
                selected
                  ? "border-filament shadow-[0_0_0_1px_var(--filament)]"
                  : "border-line hover:border-filament/50"
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
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const id = isThemeId(stored) ? stored : DEFAULT_THEME;
    setTheme(id);
    applyTheme(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-theme-picker]")) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  function choose(id: ThemeId) {
    setTheme(id);
    applyTheme(id);
    localStorage.setItem(THEME_STORAGE_KEY, id);
  }

  const current = THEMES.find((item) => item.id === theme) ?? THEMES[0];
  const dark = THEMES.filter((item) => item.group === "dark");
  const light = THEMES.filter((item) => item.group === "light");

  return (
    <div className="relative" data-theme-picker>
      <button
        type="button"
        className="rounded-md border border-line bg-cream px-2.5 py-1 text-sm text-foreground"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Theme · {current.name}
      </button>
      {open ? (
        <div
          className="absolute right-0 z-30 mt-2 w-[min(36rem,calc(100vw-2rem))] max-h-[min(70vh,36rem)] overflow-y-auto rounded-xl border border-line bg-background p-3 shadow-lg"
          role="dialog"
          aria-label="Choose theme"
        >
          <div className="flex flex-col gap-4">
            <SwatchGrid title="Dark" items={dark} theme={theme} onChoose={choose} />
            <SwatchGrid title="Light" items={light} theme={theme} onChoose={choose} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
