// The inline markdown that How-to and the changelog use: **label** and `code`. Plain strings
// only, never HTML. An unmatched ** or ` stays as text.

export type RichSegment = { kind: "text" | "bold" | "code"; text: string };

const TOKEN = /(\*\*[^*]+\*\*|`[^`]+`)/;

export function richSegments(text: string): RichSegment[] {
  const segments: RichSegment[] = [];
  for (const part of text.split(TOKEN)) {
    if (!part) continue;
    if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
      segments.push({ kind: "bold", text: part.slice(2, -2) });
    } else if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) {
      segments.push({ kind: "code", text: part.slice(1, -1) });
    } else {
      segments.push({ kind: "text", text: part });
    }
  }
  return segments;
}
