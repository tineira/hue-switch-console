import { isVersion, parsePartName, parseProductId, readPart } from "@/lib/firmware";
import { databaseError, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ product: string; version: string; name: string }> };

// A released part never changes, so the CDN keeps it for good and the database is read about once.
async function serve(context: Params, withBody: boolean) {
  const raw = await context.params;
  const product = parseProductId(raw.product);
  const name = parsePartName(raw.name);
  if (!product || !name || !isVersion(raw.version)) return jsonError(404, "not_found");
  try {
    const part = await readPart(product, raw.version, name);
    if (!part) return jsonError(404, "not_found");
    return new Response(withBody ? part.data : null, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(part.data.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        ETag: `"${part.sha256}"`,
      },
    });
  } catch (err) {
    return databaseError(err);
  }
}

export async function GET(_req: Request, context: Params) {
  return serve(context, true);
}

export async function HEAD(_req: Request, context: Params) {
  return serve(context, false);
}
