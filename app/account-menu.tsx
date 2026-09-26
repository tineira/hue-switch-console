"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SignOutButton } from "@/app/sign-out-button";

const BASE_ITEMS = [
  { href: "/account", label: "Account" },
  { href: "/keys", label: "API keys" },
  { href: "/changelog", label: "Changelog" },
];

export function AccountMenu({ email, isAdmin }: { email?: string; isAdmin?: boolean }) {
  const ITEMS = isAdmin ? [...BASE_ITEMS, { href: "/admin", label: "Admin" }] : BASE_ITEMS;
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-account-menu]")) return;
      setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const active = ITEMS.some((item) => path.startsWith(item.href));

  return (
    <div className="relative" data-account-menu>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`flex min-h-11 max-w-[7.5rem] sm:max-w-[16rem] touch-manipulation items-center gap-1.5 rounded-md px-2.5 py-1 text-sm sm:min-h-0 ${
          active || open ? "bg-filament-soft text-foreground" : "text-muted hover:text-foreground"
        }`}
      >
        <span className="truncate">{email ?? "Account"}</span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4 shrink-0"
          aria-hidden="true"
        >
          <path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" />
        </svg>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 flex w-48 flex-col rounded-xl border border-line bg-cream p-1 text-sm shadow-lg"
        >
          {ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={`rounded-md px-3 py-2 ${
                path.startsWith(item.href)
                  ? "bg-filament-soft text-foreground"
                  : "text-foreground hover:bg-background"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <div className="my-1 border-t border-line" />
          <div className="px-3 py-2">
            <SignOutButton />
          </div>
        </div>
      ) : null}
    </div>
  );
}
