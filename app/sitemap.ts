import type { MetadataRoute } from "next";
import { PRODUCT_CONSOLE_URL } from "@/lib/web-setup/products";

// Pages a signed-out visitor can read. How-to has one URL per product (docs/specs/public-how-to-changelog.md D3).
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: PRODUCT_CONSOLE_URL, priority: 1 },
    { url: `${PRODUCT_CONSOLE_URL}/how-to?product=round`, priority: 0.8 },
    { url: `${PRODUCT_CONSOLE_URL}/how-to?product=simple`, priority: 0.8 },
    { url: `${PRODUCT_CONSOLE_URL}/changelog`, priority: 0.5 },
    { url: `${PRODUCT_CONSOLE_URL}/credits`, priority: 0.5 },
    { url: `${PRODUCT_CONSOLE_URL}/privacy`, priority: 0.3 },
  ];
}
