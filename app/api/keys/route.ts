import { getSessionUser } from "@/lib/auth";
import { insertApiKey, listApiKeys, toApiKeyPublic } from "@/lib/db";
import { isDbConfigured } from "@/lib/env";
import { databaseError, jsonError, jsonOk } from "@/lib/http";
import { accountLimits } from "@/lib/limits";
import { asString } from "@/lib/parse";
import { generateDeviceToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDbConfigured()) {
    return jsonError(503, "database_not_configured");
  }
  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthorized");
  try {
    const keys = await listApiKeys(user.id);
    return jsonOk({ keys: keys.map(toApiKeyPublic) });
  } catch (err) {
    return databaseError(err);
  }
}

export async function POST(req: Request) {
  if (!isDbConfigured()) {
    return jsonError(503, "database_not_configured");
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
    const limits = await accountLimits(user.id);
    const row = await insertApiKey({
      userId: user.id,
      name,
      prefix: generated.prefix,
      hash: generated.hash,
      limit: limits.keys,
    });
    if (!row) {
      return jsonError(400, "limit_reached", {
        details: `This account can have ${limits.keys} active keys. Revoke one first.`,
      });
    }
    return jsonOk(
      {
        ...toApiKeyPublic(row),
        token: generated.token,
      },
      201,
    );
  } catch (err) {
    return databaseError(err);
  }
}
