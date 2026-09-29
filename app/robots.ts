import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/origin";

// Signed-in pages only redirect crawlers to /login, and the API and firmware routes are for switches.
const PRIVATE = [
  "/api/",
  "/firmware/",
  "/account",
  "/admin",
  "/bridges",
  "/devices",
  "/install",
  "/keys",
  "/lights",
  "/setup",
  "/switches",
];

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await siteOrigin();
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE },
    sitemap: `${origin}/sitemap.xml`,
  };
}
