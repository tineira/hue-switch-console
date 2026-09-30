import { describe, expect, it } from "vitest";
import { richSegments } from "@/lib/rich-text";

describe("richSegments", () => {
  it("keeps plain text as one segment", () => {
    expect(richSegments("Nothing special.")).toEqual([{ kind: "text", text: "Nothing special." }]);
  });

  it("finds bold and code in one line", () => {
    expect(richSegments("Click **Save** to run `npm test` now")).toEqual([
      { kind: "text", text: "Click " },
      { kind: "bold", text: "Save" },
      { kind: "text", text: " to run " },
      { kind: "code", text: "npm test" },
      { kind: "text", text: " now" },
    ]);
  });

  it("leaves unmatched markers as text", () => {
    expect(richSegments("a ** b ` c")).toEqual([{ kind: "text", text: "a ** b ` c" }]);
  });

  it("keeps asterisks inside code", () => {
    expect(richSegments("`a**b`")).toEqual([{ kind: "code", text: "a**b" }]);
  });
});
