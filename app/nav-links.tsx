"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Inside a Bridge, Switches (and later Lights) stay on it; elsewhere `/switches`
// redirects to the only Bridge or the Bridge picker (docs/specs/page-structure.md).
function bridgeBase(path: string): string | null {
  const match = /^\/bridges\/([^/]+)/.exec(path);
  return match ? `/bridges/${match[1]}` : null;
}

export function NavLinks() {
  const path = usePathname();
  const base = bridgeBase(path);
  const links = [
    {
      href: base ? `${base}/switches` : "/switches",
      label: "Switches",
      active: path === "/" || path === "/switches" || /^\/bridges\/[^/]+\/switches(\/|$)/.test(path),
    },
    {
      href: "/setup",
      label: "Setup",
      active: path.startsWith("/setup"),
    },
    {
      href: "/how-to",
      label: "How-to",
      active: path.startsWith("/how-to"),
    },
  ];
  return (
    <nav className="flex gap-1 text-sm font-medium">
      {links.map((link) => (
        <Link
          key={link.label}
          href={link.href}
          aria-current={link.active ? "page" : undefined}
          className={`rounded-md px-2.5 py-1 ${
            link.active
              ? "bg-filament-soft text-foreground"
              : "text-muted hover:text-foreground"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
