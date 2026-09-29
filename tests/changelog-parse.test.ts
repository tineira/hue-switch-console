import { describe, expect, it } from "vitest";
import { notesToItems, parseChangelog } from "@/lib/changelog-parse";

const doc = `# Changelog

What changed. Newest first.

<!-- Contributors: this comment is ignored. -->

## Console

The console has no version number.

### 2026-09-29

- Keeps the rooms it had.
- Starts in the light theme.

### 2026-09-28

- Update over Wi-Fi.

## Round

A round screen.

### 0.6.0 — 2026-09-28

- Important: Update over USB first.
- Pages swipe.

## Simple

### Before 0.1.1

- First build.
`;

describe("parseChangelog", () => {
  const parsed = parseChangelog(doc);

  it("reads the intro and the sections in order, skipping the title and HTML comments", () => {
    expect(parsed.intro).toEqual(["What changed. Newest first."]);
    expect(parsed.sections.map((s) => [s.id, s.title])).toEqual([
      ["console", "Console"],
      ["round", "Round"],
      ["simple", "Simple"],
    ]);
    expect(JSON.stringify(parsed)).not.toContain("Contributors");
  });

  it("keeps each section's intro paragraph", () => {
    expect(parsed.sections[0].intro).toEqual(["The console has no version number."]);
    expect(parsed.sections[1].intro).toEqual(["A round screen."]);
    expect(parsed.sections[2].intro).toEqual([]);
  });

  it("reads dated entries with their bullets", () => {
    const [first, second] = parsed.sections[0].entries;
    expect(first).toEqual({
      id: "console-2026-09-29",
      heading: "2026-09-29",
      date: null,
      items: [
        { text: "Keeps the rooms it had.", important: false },
        { text: "Starts in the light theme.", important: false },
      ],
    });
    expect(second.id).toBe("console-2026-09-28");
    expect(second.items).toHaveLength(1);
  });

  it("splits a version heading from its date and ids it by version", () => {
    const [entry] = parsed.sections[1].entries;
    expect(entry.id).toBe("round-0.6.0");
    expect(entry.heading).toBe("0.6.0");
    expect(entry.date).toBe("2026-09-28");
    expect(entry.items).toEqual([
      { text: "Update over USB first.", important: true },
      { text: "Pages swipe.", important: false },
    ]);
  });

  it("slugs a heading that is not a version", () => {
    expect(parsed.sections[2].entries[0].id).toBe("simple-before-0-1-1");
  });

  it("accepts CRLF line endings", () => {
    expect(parseChangelog(doc.replace(/\n/g, "\r\n"))).toEqual(parsed);
  });

  it("rejects malformed files", () => {
    expect(() => parseChangelog("Just text.\n")).toThrow("no sections");
    expect(() => parseChangelog("## A\n\n### 1.0.0\n\n## B\n")).toThrow("empty entry a-1.0.0");
    expect(() => parseChangelog("## A\n\n- stray\n")).toThrow("bullet before an entry");
    expect(() => parseChangelog("### 1.0.0\n\n- x\n")).toThrow("entry before a section");
    expect(() => parseChangelog("## A\n\n## A\n")).toThrow("duplicate id a");
    expect(() => parseChangelog("## A\n\n### 1.0.0\n\n- x\nloose text\n")).toThrow(
      "text inside a-1.0.0",
    );
  });
});

describe("notesToItems", () => {
  it("turns bullets into items", () => {
    expect(notesToItems("- One.\n- Two.\n")).toEqual([
      { text: "One.", important: false },
      { text: "Two.", important: false },
    ]);
  });

  it("flags a bullet that starts with Important:", () => {
    expect(notesToItems("- Important: Re-pair after updating.\n- Faster dimming.")).toEqual([
      { text: "Re-pair after updating.", important: true },
      { text: "Faster dimming.", important: false },
    ]);
  });

  it("only flags Important: at the start of a bullet", () => {
    expect(notesToItems("- Not Important: really.")).toEqual([
      { text: "Not Important: really.", important: false },
    ]);
  });

  it("joins wrapped lines to their bullet and skips blanks and comments", () => {
    expect(
      notesToItems("<!-- note -->\n- A long bullet\n  that wraps.\n\n- Next.\r\n"),
    ).toEqual([
      { text: "A long bullet that wraps.", important: false },
      { text: "Next.", important: false },
    ]);
  });

  it("keeps a line without a bullet as its own item", () => {
    expect(notesToItems("Plain note.")).toEqual([{ text: "Plain note.", important: false }]);
  });
});
