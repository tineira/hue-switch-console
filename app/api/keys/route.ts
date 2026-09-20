import { getSessionUser } from "@/lib/auth";
import { insertApiKey, listApiKeys, toApiKeyPublic } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http";
import { asString } from "@/lib/parse";
import { generateDeviceToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return jsonError(503, "supabase_not_configured");
  }
  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthorized");
  try {
    const keys = await listApiKeys(user.id);
    return jsonOk({ keys: keys.map(toApiKeyPublic) });
  } catch (err) {
    const details = err instanceof Error ? err.message : "unknown";
    return jsonError(500, "database_error", { details });
  }
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return jsonError(503, "supabase_not_configured");
  }
  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthorized");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "invalid_json");
  }
  const name = asString((body as { name?: unknown })?.name);
  if (!name) return jsonError(400, "name is required");
  if (name.length > 80) return jsonError(400, "name is too long");

  const generated = generateDeviceToken();
  try {
    const row = await insertApiKey({
      userId: user.id,
      name,
      prefix: generated.prefix,
      hash: generated.hash,
    });
    return jsonOk(
      {
        ...toApiKeyPublic(row),
        token: generated.token,
      },
      201,
    );
  } catch (err) {
    const details = err instanceof Error ? err.message : "unknown";
    return jsonError(500, "database_error", { details });
  }
}
