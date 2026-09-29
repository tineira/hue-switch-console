"use client";

import { useEffect, useState } from "react";
import { THEME_STORAGE_KEY, systemTheme } from "@/app/themes";

type LandingTheme = "ember" | "paper";

function readStored(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

// The signed-out home page offers only Ember and Paper. A stored theme that is not Paper
// shows as Ember here; storage changes only when the visitor clicks the toggle.
export function ThemeToggle() {
  const [theme, setTheme] = useState<LandingTheme>("ember");

  useEffect(() => {
    const stored = readStored();
    const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    const initial: LandingTheme = stored
      ? stored === "paper"
        ? "paper"
        : "ember"
      : prefersLight
        ? "paper"
        : "ember";
    document.documentElement.dataset.theme = initial;
    // localStorage exists only after hydration; reading it in the initial state would mismatch the server render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(initial);
    // Other pages keep the stored theme, or follow the system setting.
    return () => {
      document.documentElement.dataset.theme = readStored() ?? systemTheme();
    };
  }, []);

  function toggle() {
    const next: LandingTheme = theme === "paper" ? "ember" : "paper";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {}
    setTheme(next);
  }

  const label = theme === "paper" ? "Switch to dark" : "Switch to light";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-line bg-cream hover:border-filament"
    >
      <span className="block h-4 w-4 rounded-full border-[1.5px] border-foreground bg-[linear-gradient(90deg,var(--foreground)_50%,transparent_50%)]" />
    </button>
  );
}
