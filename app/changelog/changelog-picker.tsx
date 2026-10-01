"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ProductPicture } from "@/app/how-to/product-picture";
import { CHANGELOG_IDS, changelogHref, type ChangelogId } from "@/lib/changelog-href";

const SELECTED = "border-filament shadow-[0_0_0_1px_var(--filament)]";

export type ChangelogCard = { id: ChangelogId; title: string; latest: string | null };

// The console has no board, so its card shows a browser window with the dial from the app icon.
function ConsolePicture() {
  return (
    <svg viewBox="0 0 160 100" aria-hidden="true" className="absolute inset-0 h-full w-full">
      <rect x="8" y="8" width="144" height="84" rx="7" fill="var(--cream)" stroke="var(--line)" strokeWidth="2" />
      <path d="M8 26h144" stroke="var(--line)" strokeWidth="2" />
      <circle cx="19" cy="17" r="2.6" fill="var(--line)" />
      <circle cx="28" cy="17" r="2.6" fill="var(--line)" />
      <circle cx="37" cy="17" r="2.6" fill="var(--line)" />
      <circle cx="46" cy="59" r="16" fill="none" stroke="var(--line)" strokeWidth="6" />
      <path d="M34.7 70.3A16 16 0 1 1 59.9 51" fill="none" stroke="var(--filament)" strokeWidth="6" />
      <circle cx="46" cy="59" r="7" fill="var(--filament)" />
      <rect x="76" y="44" width="58" height="6" rx="3" fill="var(--line)" />
      <rect x="76" y="56" width="44" height="6" rx="3" fill="var(--line)" />
      <rect x="76" y="68" width="50" height="6" rx="3" fill="var(--line)" />
    </svg>
  );
}

// Round, Simple, Console as a row of cards, like the compact row on /how-to. Each card is a link
// (`?product=`), so the server renders the picked changelog; with none picked it is the console's.
export function ChangelogPicker({ cards, selected }: { cards: ChangelogCard[]; selected: ChangelogId }) {
  const router = useRouter();

  // Links from before the picker (/changelog#round-0.5.28, #simple) name the changelog in the hash.
  // A console hash already lands on the console's changelog.
  useEffect(() => {
    if (selected !== "console") return;
    function follow() {
      const hash = window.location.hash.slice(1);
      const id = CHANGELOG_IDS.find((name) => name !== "console" && (hash === name || hash.startsWith(`${name}-`)));
      if (id) router.replace(changelogHref(id, hash === id ? undefined : hash));
    }
    follow();
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, [selected, router]);

  return (
    <nav className="grid grid-cols-3 gap-2.5" aria-label="Which changelog">
      {cards.map(({ id, title, latest }) => {
        const on = id === selected;
        return (
          <Link
            key={id}
            href={changelogHref(id)}
            scroll={false}
            aria-current={on ? "page" : undefined}
            className={`flex min-w-0 touch-manipulation flex-row items-center overflow-hidden rounded-xl border bg-cream text-left ${
              on ? SELECTED : "border-line hover:border-muted"
            }`}
          >
            <span
              className="relative hidden aspect-[16/10] w-[92px] shrink-0 self-stretch border-r border-line bg-background sm:block"
            >
              <span className="absolute inset-[8%]">
                {id === "console" ? <ConsolePicture /> : <ProductPicture product={id} />}
              </span>
            </span>
            <span className="flex min-w-0 flex-col gap-0.5 px-3 py-2">
              <span className={`text-sm font-semibold ${on ? "text-filament" : ""}`}>
                {title}
              </span>
              {latest ? (
                <span className="truncate text-xs text-muted">
                  <span className="hidden sm:inline">Latest </span>
                  {latest}
                </span>
              ) : null}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
