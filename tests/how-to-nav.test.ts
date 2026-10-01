import { describe, expect, it } from "vitest";
import { fromOldAnchor, howToHref, readHowTo, type HowTo } from "@/lib/how-to-nav";

const read = (q: string) => {
  const p = new URLSearchParams(q);
  return readHowTo((k) => p.get(k));
};
const none: HowTo = { product: null, topic: null, level: "box" };

describe("readHowTo", () => {
  it("reads switch, topic and level", () => {
    expect(read("product=simple&topic=build&level=wall")).toEqual({ product: "simple", topic: "build", level: "wall" });
    expect(read("product=round&topic=status")).toEqual({ product: "round", topic: "status", level: "box" });
  });

  it("needs a switch before a topic, and Simple's Build for a level", () => {
    expect(read("topic=setup")).toEqual(none);
    expect(read("product=round&topic=build&level=try").level).toBe("box");
    expect(read("product=simple&topic=setup&level=try").level).toBe("box");
  });

  it("ignores unknown values", () => {
    expect(read("product=round&topic=nope")).toEqual({ product: "round", topic: null, level: "box" });
    expect(read("product=x&topic=setup")).toEqual(none);
    expect(read("product=simple&topic=build&level=x").level).toBe("box");
  });
});

describe("howToHref", () => {
  it("writes only what applies", () => {
    expect(howToHref({})).toBe("/how-to");
    expect(howToHref({ product: "round" })).toBe("/how-to?product=round");
    expect(howToHref({ product: "round", topic: "build", level: "wall" })).toBe("/how-to?product=round&topic=build");
    expect(howToHref({ product: "simple", topic: "build" })).toBe("/how-to?product=simple&topic=build&level=box");
    expect(howToHref({ product: "simple", topic: "build", level: "try" }, "try")).toBe(
      "/how-to?product=simple&topic=build&level=try#try",
    );
  });
});

describe("fromOldAnchor", () => {
  const round: HowTo = { product: "round", topic: null, level: "box" };
  const simple: HowTo = { product: "simple", topic: null, level: "box" };

  it("maps section anchors to topics", () => {
    expect(fromOldAnchor("status", simple)).toEqual({ to: { product: "simple", topic: "status", level: "box" }, hash: "" });
    expect(fromOldAnchor("setup", round)?.to.topic).toBe("setup");
    expect(fromOldAnchor("tasks", round)?.to.topic).toBe("tasks");
    expect(fromOldAnchor("build", simple)).toEqual({ to: { product: "simple", topic: "build", level: "box" }, hash: "" });
  });

  it("keeps the anchor inside a topic", () => {
    expect(fromOldAnchor("status-nowifi", round)).toEqual({ to: { product: "round", topic: "status", level: "box" }, hash: "status-nowifi" });
    expect(fromOldAnchor("assemble", round)?.hash).toBe("assemble");
  });

  it("picks the switch and build type the anchor belongs to", () => {
    expect(fromOldAnchor("simple", none)?.to.product).toBe("simple");
    expect(fromOldAnchor("try", none)?.to).toEqual({ product: "simple", topic: "build", level: "try" });
    expect(fromOldAnchor("resistors", none)?.to.level).toBe("box");
    expect(fromOldAnchor("install", round)?.to).toEqual({ product: "simple", topic: "build", level: "wall" });
  });

  it("shows the Round when an old link had no switch", () => {
    expect(fromOldAnchor("status", none)?.to.product).toBe("round");
  });

  it("leaves new links and other anchors alone", () => {
    expect(fromOldAnchor("assemble", { product: "round", topic: "build", level: "box" })).toBeNull();
    expect(fromOldAnchor("", round)).toBeNull();
    expect(fromOldAnchor("something", round)).toBeNull();
  });
});
