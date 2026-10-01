import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/origin";

// Pages a signed-out visitor can read. How-to has one URL per product (docs/specs/finished/public-how-to-changelog.md D3).
// This console's own address (BETTER_AUTH_URL, else the request), so a self-hosted one lists its own pages.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await siteOrigin();
  return [
    { url: origin, priority: 1 },
    { url: `${origin}/how-to?product=round`, priority: 0.8 },
    { url: `${origin}/how-to?product=simple`, priority: 0.8 },
    { url: `${origin}/changelog`, priority: 0.5 },
    { url: `${origin}/credits`, priority: 0.5 },
    { url: `${origin}/safety`, priority: 0.5 },
    { url: `${origin}/privacy`, priority: 0.3 },
  ];
}
