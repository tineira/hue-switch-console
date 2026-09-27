import { ensureSchema } from "@/lib/ensure-schema";
import { isVersion, parseProductId, setCurrentRelease, uploadTokenMatches } from "@/lib/firmware";
import { bearerToken, databaseError, jsonError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

// Rolls the installer back (or forward) to a stored release.
export async function POST(req: Request, context: { params: Promise<{ product: string }> }) {
  const auth = uploadTokenMatches(bearerToken(req));
  if (auth === null) return jsonError(503, "upload_not_configured");
  if (!auth) return jsonError(401, "unauthorized");

  const product = parseProductId((await context.params).product);
  if (!product) return jsonError(404, "unknown_product");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "invalid_json");
  }
  const version = String((body as { version?: unknown } | null)?.version ?? "");
  if (!isVersion(version)) return jsonError(400, "invalid_version");

  try {
    await ensureSchema();
    if (!(await setCurrentRelease(product, version))) {
      return jsonError(404, "version_not_stored", { version });
    }
    return jsonOk({ product, version });
  } catch (err) {
    return databaseError(err);
  }
}
