import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/origin";
import { CHANGELOG_IDS, changelogHref } from "@/lib/changelog-href";
import { howToPages } from "@/lib/how-to-nav";

// Pages a signed-out visitor can read. How-to has one URL per switch and topic, and per build type
// on the Simple's Build (docs/specs/finished/how-to-navigation.md §2.3). Changelog has one per switch
// besides its own, which shows the console's.
// This console's own address (BETTER_AUTH_URL, else the request), so a self-hosted one lists its own pages.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await siteOrigin();
  return [
    { url: origin, priority: 1 },
    { url: `${origin}/how-to`, priority: 0.8 },
    ...howToPages().map((path) => ({ url: `${origin}${path}`, priority: 0.7 })),
    { url: `${origin}/changelog`, priority: 0.5 },
    // The console's changelog is /changelog itself.
    ...CHANGELOG_IDS.filter((id) => id !== "console").map((id) => ({ url: `${origin}${changelogHref(id)}`, priority: 0.4 })),
    { url: `${origin}/credits`, priority: 0.5 },
    { url: `${origin}/safety`, priority: 0.5 },
    { url: `${origin}/privacy`, priority: 0.3 },
  ];
}
