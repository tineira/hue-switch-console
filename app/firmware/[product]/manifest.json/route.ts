import { currentManifest, parseProductId } from "@/lib/firmware";
import { databaseError, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

// What Setup (/setup) flashes: the product's current uploaded release.
export async function GET(_req: Request, context: { params: Promise<{ product: string }> }) {
  const product = parseProductId((await context.params).product);
  if (!product) return jsonError(404, "unknown_product");
  try {
    const manifest = await currentManifest(product);
    if (!manifest) return jsonError(404, "no_release");
    return Response.json(manifest, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return databaseError(err);
  }
}
