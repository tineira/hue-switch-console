import { afterEach, describe, expect, it, vi } from "vitest";
import { hasTerms, operatorTermsUrl, requiredDocuments, SAFETY_VERSION, termsVersion } from "@/lib/terms";

// Which documents a console asks for (docs/specs/terms-and-safety.md §2.1, §2.2).

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("requiredDocuments", () => {
  it("asks for Safety and the hosted Terms on the hosted console", () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://hue.tineira.com");
    vi.stubEnv("TERMS_URL", "https://example.org/terms");
    vi.stubEnv("TERMS_VERSION", "operator-2");
    expect(hasTerms()).toBe(true);
    // The hosted console ignores the operator settings.
    expect(operatorTermsUrl()).toBeNull();
    expect(termsVersion()).not.toBe("operator-2");
    expect(requiredDocuments().map((d) => d.document)).toEqual(["safety", "terms"]);
  });

  it("asks only for Safety on a self-hosted console without TERMS_URL", () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://hue.example.org");
    vi.stubEnv("TERMS_URL", "");
    expect(hasTerms()).toBe(false);
    expect(requiredDocuments()).toEqual([{ document: "safety", version: SAFETY_VERSION }]);
  });

  it("adds the operator's Terms and version on a self-hosted console with TERMS_URL", () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://hue.example.org");
    vi.stubEnv("TERMS_URL", "https://example.org/terms");
    vi.stubEnv("TERMS_VERSION", "operator-2");
    expect(operatorTermsUrl()).toBe("https://example.org/terms");
    expect(requiredDocuments()).toEqual([
      { document: "safety", version: SAFETY_VERSION },
      { document: "terms", version: "operator-2" },
    ]);
  });
});
