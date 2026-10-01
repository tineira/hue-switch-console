"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Pages: docs/specs/finished/page-structure.md.
export function NavLinks() {
  const path = usePathname();
  const links = [
    {
      href: "/switches",
      label: "Switches",
      // Setup is part of Switches: reached from its header, a switch's card, How-to.
      active:
        path === "/" ||
        path === "/switches" ||
        path.startsWith("/switches/") ||
        path.startsWith("/setup"),
    },
    {
      href: "/lights",
      label: "Lights",
      active: path.startsWith("/lights"),
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
