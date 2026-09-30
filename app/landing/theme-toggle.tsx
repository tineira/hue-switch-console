"use client";

import { useEffect, useState } from "react";
import { applyTheme, chooseTheme, currentTheme, oppositeTheme, schemeOf, type ThemeId } from "@/app/themes";

// The signed-out home page shows whichever theme is stored (any of them), else the system default.
// The toggle flips dark/light: to the last theme used in the other scheme, else Slate or Slate Light.
export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeId | null>(null);

  useEffect(() => {
    const id = currentTheme();
    applyTheme(id);
    // localStorage exists only after hydration; reading it in the initial state would mismatch the server render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(id);
  }, []);

  function toggle() {
    const next = oppositeTheme(theme ?? currentTheme());
    chooseTheme(next);
    setTheme(next);
  }

  const label = theme && schemeOf(theme) === "light" ? "Switch to dark" : "Switch to light";
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
