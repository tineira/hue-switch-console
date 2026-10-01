import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ChangelogPicker, type ChangelogCard } from "@/app/changelog/changelog-picker";
import { ChangelogItemText } from "@/app/changelog-item";
import { PublicFrame } from "@/app/public-frame";
import { Rich } from "@/app/rich-text";
import { Shell } from "@/app/shell";
import { getSessionUser } from "@/lib/auth";
import { CHANGELOG_IDS, changelogHref, isChangelogId, type ChangelogId } from "@/lib/changelog-href";
import {
  notesToItems,
  parseChangelog,
  type ChangelogDoc,
  type ChangelogEntry,
  type ChangelogSection,
} from "@/lib/changelog-parse";
import { listReleaseNotes, parseProductId } from "@/lib/firmware";

export const dynamic = "force-dynamic";

const DESCRIPTION = "What changed in Hue Switch Console and the Round and Simple switch firmware.";

// No `?product=` (or an unknown one) opens the console's changelog.
function picked(value: unknown): ChangelogId {
  return isChangelogId(value) ? value : "console";
}

// Each changelog has its own URL (`?product=`), so search lists them apart.
export async function generateMetadata({ searchParams }: PageProps<"/changelog">): Promise<Metadata> {
  const id = picked((await searchParams).product);
  if (id === "console") return { title: "Changelog", description: DESCRIPTION, alternates: { canonical: "/changelog" } };
  const name = id === "round" ? "Round switch" : "Simple switch";
  return {
    title: `${name} changelog`,
    description: `What changed in the ${name} firmware.`,
    alternates: { canonical: changelogHref(id) },
  };
}

// Console entries live in docs/changelog.md; Round and Simple entries arrive with each firmware upload.
async function loadChangelog() {
  const file = path.join(process.cwd(), "docs", "changelog.md");
  const doc = parseChangelog(readFileSync(file, "utf8"));
  for (const section of doc.sections) {
    const product = parseProductId(section.id);
    if (!product) continue;
    const releases = await listReleaseNotes(product).catch(() => []);
    section.entries = [
      ...releases.map((release) => ({
        id: `${section.id}-${release.version}`,
        heading: release.version,
        date: release.date,
        items: notesToItems(release.notes),
      })),
      ...section.entries,
    ];
  }
  return doc;
}

function EntryHeading({ entry }: { entry: ChangelogEntry }) {
  const version = /^\d+\.\d+\.\d+$/.test(entry.heading);
  return (
    <h3
      className={`text-sm font-medium ${version ? "font-mono" : ""}`}
    >
      {entry.heading}
      {entry.date ? (
        <span className="ml-2 font-sans font-normal text-muted">{entry.date}</span>
      ) : null}
    </h3>
  );
}

// The newest entry's heading, for its card: a firmware version, or the console's day.
function latest(section: ChangelogSection): string | null {
  return section.entries[0]?.heading ?? null;
}

function ChangelogContent({ doc, selected }: { doc: ChangelogDoc; selected: ChangelogId }) {
  const cards: ChangelogCard[] = CHANGELOG_IDS.flatMap((id) => {
    const section = doc.sections.find((s) => s.id === id);
    return section ? [{ id, title: section.title, latest: latest(section) }] : [];
  });
  const section = doc.sections.find((s) => s.id === selected);
  return (
    <>
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Changelog</h1>
        {doc.intro.map((paragraph) => (
          <p key={paragraph} className="max-w-2xl text-sm text-muted">
            <Rich text={paragraph} />
          </p>
        ))}
      </section>

      <ChangelogPicker cards={cards} selected={selected} />

      {section ? (
        <section key={section.id} id={section.id} className="flex scroll-mt-8 flex-col gap-4 border-t border-line pt-6">
          <h2 className="text-lg font-medium">{section.title}</h2>
          {section.intro.map((paragraph) => (
            <p key={paragraph} className="max-w-2xl text-sm text-muted">
              <Rich text={paragraph} />
            </p>
          ))}
          <div className="flex flex-col gap-5">
            {section.entries.map((entry) => (
              <article key={entry.id} id={entry.id} className="scroll-mt-8">
                <EntryHeading entry={entry} />
                <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
                  {entry.items.map((item) => (
                    <li key={item.text}>
                      <ChangelogItemText item={item} />
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

// Public: signed-out visitors get the same page (docs/specs/finished/public-how-to-changelog.md §4.3).
export default async function ChangelogPage({ searchParams }: PageProps<"/changelog">) {
  const selected = picked((await searchParams).product);
  const user = await getSessionUser({ allowPending: true }).catch(() => null);
  const doc = await loadChangelog();

  if (user) {
    return (
      <Shell email={user.email}>
        <ChangelogContent doc={doc} selected={selected} />
      </Shell>
    );
  }
  return (
    <PublicFrame>
      <ChangelogContent doc={doc} selected={selected} />
    </PublicFrame>
  );
}
