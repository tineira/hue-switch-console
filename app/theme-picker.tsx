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
    setOpen(false);
  }

  const current = THEMES.find((item) => item.id === theme) ?? THEMES[1];

  return (
    <div className="relative" data-theme-picker>
      <button
        type="button"
        className="rounded-md border border-line bg-cream px-2.5 py-1 text-sm text-foreground"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Theme · {current.name}
      </button>
      {open ? (
        <ul
          className="absolute right-0 z-20 mt-1 min-w-52 rounded-lg border border-line bg-cream p-1 shadow-lg"
          role="listbox"
        >
          {THEMES.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={item.id === theme}
                className={`flex w-full flex-col rounded-md px-3 py-2 text-left text-sm ${
                  item.id === theme ? "bg-filament-soft" : "hover:bg-background"
                }`}
                onClick={() => choose(item.id)}
              >
                <span className="font-medium">{item.name}</span>
                <span className="text-xs text-muted">{item.blurb}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
