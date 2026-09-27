import type { MetadataRoute } from "next";
import { PRODUCT_CONSOLE_URL } from "@/lib/web-setup/products";

// Pages a signed-out visitor can read. Add /how-to and /changelog once they are public.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: PRODUCT_CONSOLE_URL, priority: 1 },
    { url: `${PRODUCT_CONSOLE_URL}/credits`, priority: 0.5 },
    { url: `${PRODUCT_CONSOLE_URL}/privacy`, priority: 0.3 },
  ];
}
