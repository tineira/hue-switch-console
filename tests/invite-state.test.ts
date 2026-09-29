import { describe, expect, it } from "vitest";
import { inviteState } from "@/lib/signup";

const NOW = Date.parse("2026-09-29T12:00:00Z");
const base = {
  used_at: null,
  revoked_at: null,
  expires_at: "2026-10-06T12:00:00Z",
  undeliverable: null,
};

describe("inviteState (/admin invites)", () => {
  it("an unused invite before its expiry is open", () => {
    expect(inviteState(base, NOW)).toBe("open");
  });

  it("an unused invite past its expiry is expired", () => {
    expect(inviteState({ ...base, expires_at: "2026-09-28T12:00:00Z" }, NOW)).toBe("expired");
  });

  it("a used invite stays used, even if revoked or bounced later", () => {
    expect(
      inviteState(
        { ...base, used_at: "2026-09-29T10:00:00Z", revoked_at: "2026-09-29T11:00:00Z", undeliverable: "bounced" },
        NOW,
      ),
    ).toBe("used");
  });

  it("an invite revoked by hand says revoked", () => {
    expect(inviteState({ ...base, revoked_at: "2026-09-29T11:00:00Z" }, NOW)).toBe("revoked");
  });

  it("an invite revoked because its email bounced says bounced", () => {
    expect(
      inviteState({ ...base, revoked_at: "2026-09-29T11:00:00Z", undeliverable: "bounced" }, NOW),
    ).toBe("bounced");
  });

  it("an invite revoked because it was marked spam says complained", () => {
    expect(
      inviteState({ ...base, revoked_at: "2026-09-29T11:00:00Z", undeliverable: "complained" }, NOW),
    ).toBe("complained");
  });
});
