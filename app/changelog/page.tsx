import { readFileSync } from "node:fs";
import path from "node:path";
import { Shell } from "@/app/shell";
import { requireSessionUser } from "@/lib/auth";
import { notesToItems, parseChangelog, type ChangelogEntry } from "@/lib/changelog-parse";
import { listReleaseNotes, parseProductId } from "@/lib/firmware";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Changelog",
};

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

export default async function ChangelogPage() {
  const user = await requireSessionUser();
  const doc = await loadChangelog();

  return (
    <Shell email={user.email}>
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Changelog</h1>
        {doc.intro.map((paragraph) => (
          <p key={paragraph} className="max-w-2xl text-sm text-muted">
            {paragraph}
          </p>
        ))}
        <p className="flex gap-4 text-sm">
          {doc.sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="font-medium text-filament hover:underline"
            >
              {section.title}
            </a>
          ))}
        </p>
      </section>

      {doc.sections.map((section) => (
        <section key={section.id} id={section.id} className="flex scroll-mt-8 flex-col gap-4">
          <h2 className="text-lg font-medium">{section.title}</h2>
          {section.intro.map((paragraph) => (
            <p key={paragraph} className="max-w-2xl text-sm text-muted">
              {paragraph}
            </p>
          ))}
          <div className="flex flex-col gap-5">
            {section.entries.map((entry) => (
              <article key={entry.id} id={entry.id} className="scroll-mt-8">
                <EntryHeading entry={entry} />
                <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
                  {entry.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      ))}
    </Shell>
  );
}
