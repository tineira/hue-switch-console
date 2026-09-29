import { isVersion, parseProductId, releaseNotes } from "@/lib/firmware";
import { databaseError, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ product: string; version: string }> };

// Public notes and credits of a released version, so another console can import it with
// scripts/import-firmware.mjs (docs/specs/self-hosting.md §2.3). The manifest stays minimal.
export async function GET(_req: Request, context: Params) {
  const raw = await context.params;
  const product = parseProductId(raw.product);
  if (!product || !isVersion(raw.version)) return jsonError(404, "not_found");
  try {
    const release = await releaseNotes(product, raw.version);
    if (!release) return jsonError(404, "not_found");
    // Notes can be edited by a re-upload of the same version, so the CDN keeps them briefly.
    return Response.json(
      { product, ...release },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch (err) {
    return databaseError(err);
  }
}
