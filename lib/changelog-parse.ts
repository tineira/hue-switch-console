export type ChangelogEntry = {
  id: string;
  heading: string;
  date: string | null;
  items: string[];
};

export type ChangelogSection = {
  id: string;
  title: string;
  intro: string[];
  entries: ChangelogEntry[];
};

export type ChangelogDoc = {
  intro: string[];
  sections: ChangelogSection[];
};

const VERSION = /^(\d+\.\d+\.\d+)\b/;
const DATED = /^(.+?)\s+[—–-]\s+(\d{4}-\d{2}-\d{2})$/;

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function entryId(sectionId: string, heading: string): string {
  const version = heading.match(VERSION);
  if (version) return `${sectionId}-${version[1]}`;
  return `${sectionId}-${slug(heading)}`;
}

function fail(message: string): never {
  throw new Error(`changelog.md: ${message}`);
}

export function parseChangelog(markdown: string): ChangelogDoc {
  const intro: string[] = [];
  const sections: ChangelogSection[] = [];
  let section: ChangelogSection | null = null;
  let entry: ChangelogEntry | null = null;
  let paragraph: string[] = [];
  const seen = new Set<string>();

  const takeParagraph = (): string => {
    const text = paragraph.join(" ").trim();
    paragraph = [];
    return text;
  };

  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("<!--") || line.startsWith("# ")) continue;

    if (line.startsWith("## ")) {
      const text = takeParagraph();
      if (text) {
        if (!section) intro.push(text);
        else if (!entry) section.intro.push(text);
      }
      if (entry && entry.items.length === 0) fail(`empty entry ${entry.id}`);
      entry = null;
      const title = line.slice(3).trim();
      if (!title) fail("empty section title");
      const id = slug(title);
      if (seen.has(id)) fail(`duplicate id ${id}`);
      seen.add(id);
      section = { id, title, intro: [], entries: [] };
      sections.push(section);
      continue;
    }

    if (line.startsWith("### ")) {
      const text = takeParagraph();
      if (text && section && !entry) section.intro.push(text);
      if (!section) fail("entry before a section");
      if (entry && entry.items.length === 0) fail(`empty entry ${entry.id}`);
      const rawHeading = line.slice(4).trim();
      const dated = rawHeading.match(DATED);
      const heading = (dated ? dated[1] : rawHeading).trim();
      const date = dated ? dated[2] : null;
      if (!heading) fail("empty entry heading");
      const id = entryId(section.id, heading);
      if (seen.has(id)) fail(`duplicate id ${id}`);
      seen.add(id);
      entry = { id, heading, date, items: [] };
      section.entries.push(entry);
      continue;
    }

    if (line.startsWith("- ")) {
      if (!entry) fail("bullet before an entry");
      const item = line.slice(2).trim();
      if (!item) fail(`empty bullet in ${entry.id}`);
      entry.items.push(item);
      continue;
    }

    if (line === "") {
      const text = takeParagraph();
      if (text) {
        if (!section) intro.push(text);
        else if (!entry) section.intro.push(text);
      }
      continue;
    }

    if (entry) fail(`text inside ${entry.id}: ${line}`);
    paragraph.push(line);
  }

  const text = takeParagraph();
  if (text) {
    if (!section) intro.push(text);
    else if (!entry) section.intro.push(text);
  }
  if (entry && entry.items.length === 0) fail(`empty entry ${entry.id}`);
  if (sections.length === 0) fail("no sections");
  return { intro, sections };
}

// Firmware notes arrive with each upload as markdown bullets; wrapped lines join their bullet.
export function notesToItems(notes: string): string[] {
  const items: string[] = [];
  for (const raw of notes.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("<!--")) continue;
    if (line.startsWith("- ")) items.push(line.slice(2).trim());
    else if (items.length > 0) items[items.length - 1] += ` ${line}`;
    else items.push(line);
  }
  return items;
}
