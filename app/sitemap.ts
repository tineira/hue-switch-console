import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/origin";
import { howToPages } from "@/lib/how-to-nav";

// Pages a signed-out visitor can read. How-to has one URL per switch and topic, and per build type
// on the Simple's Build (docs/specs/how-to-navigation.md §2.3).
// This console's own address (BETTER_AUTH_URL, else the request), so a self-hosted one lists its own pages.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await siteOrigin();
  return [
    { url: origin, priority: 1 },
    { url: `${origin}/how-to`, priority: 0.8 },
    ...howToPages().map((path) => ({ url: `${origin}${path}`, priority: 0.7 })),
    { url: `${origin}/changelog`, priority: 0.5 },
    { url: `${origin}/credits`, priority: 0.5 },
    { url: `${origin}/privacy`, priority: 0.3 },
  ];
}
