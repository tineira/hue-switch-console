import type { MetadataRoute } from "next";
import { PRODUCT_CONSOLE_URL } from "@/lib/web-setup/products";

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

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE },
    sitemap: `${PRODUCT_CONSOLE_URL}/sitemap.xml`,
  };
}
