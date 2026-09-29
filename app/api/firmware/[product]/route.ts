import { ensureSchema } from "@/lib/ensure-schema";
import {
  checkImage,
  isVersion,
  PART_NAMES,
  parseCredits,
  parseProductId,
  type CreditEntry,
  uploadRelease,
  uploadTokenMatches,
  type UploadPart,
} from "@/lib/firmware";
import { bearerToken, databaseError, jsonError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

// Firmware CI uploads a release here (docs/specs/finished/firmware-uploads.md §2.2). It is stored,
// not made current: an admin does that in /admin.
export async function POST(req: Request, context: { params: Promise<{ product: string }> }) {
  const auth = uploadTokenMatches(bearerToken(req));
  if (auth === null) return jsonError(503, "upload_not_configured");
  if (!auth) return jsonError(401, "unauthorized");

  const product = parseProductId((await context.params).product);
  if (!product) return jsonError(404, "unknown_product");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(400, "invalid_form");
  }

  const version = String(form.get("version") ?? "").trim();
  if (!isVersion(version)) return jsonError(400, "invalid_version");
  const commit = String(form.get("commit") ?? "").trim() || null;
  const notes = String(form.get("notes") ?? "").replace(/\r\n/g, "\n").trim();
  if (!notes) return jsonError(400, "missing_notes");

  // Optional: older firmware CI does not send it (docs/specs/finished/credits.md §2.4).
  let credits: CreditEntry[] | null = null;
  const rawCredits = form.get("credits");
  if (rawCredits !== null) {
    const parsed = parseCredits(String(rawCredits));
    if ("problem" in parsed) return jsonError(400, "invalid_credits", { details: parsed.problem });
    credits = parsed.credits;
  }

  const parts: UploadPart[] = [];
  for (const name of PART_NAMES) {
    const file = form.get(name);
    if (!(file instanceof File) || file.size === 0) {
      return jsonError(400, "invalid_image", { details: `${name} is missing or empty` });
    }
    const data = new Uint8Array(await file.arrayBuffer());
    const problem = checkImage(product, name, data);
    if (problem) return jsonError(400, "invalid_image", { details: problem });
    parts.push({ name, data });
  }

  try {
    await ensureSchema();
    const result = await uploadRelease({ product, version, commit, notes, credits, parts });
    if (result.status === "version_exists") {
      return jsonError(409, "version_exists", {
        version,
        details: "This version already has different bins. Notes were updated. Bump FIRMWARE_VERSION to ship new bins.",
      });
    }
    return jsonOk(
      { product, version, status: result.status, current: result.current },
      result.status === "created" ? 201 : 200,
    );
  } catch (err) {
    return databaseError(err);
  }
}
