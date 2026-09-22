"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  {
    href: "/",
    label: "Bridge",
    match: (path: string) => path === "/" || path.startsWith("/bridges"),
  },
  {
    href: "/devices",
    label: "Devices",
    match: (path: string) => path.startsWith("/devices"),
  },
  {
    href: "/keys",
    label: "API keys",
    match: (path: string) => path.startsWith("/keys"),
  },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 text-sm font-medium">
      {LINKS.map((link) => {
        const active = link.match(path);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-md px-2.5 py-1 ${
              active
                ? "bg-filament-soft text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function ChangelogLink() {
  const path = usePathname();
  const active = path === "/changelog" || path.startsWith("/changelog/");
  return (
    <Link
      href="/changelog"
      className={active ? "text-foreground" : "text-muted hover:text-foreground"}
    >
      Changelog
    </Link>
  );
}
