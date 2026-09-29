import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

// A release is made current only by a signed-in admin, from /admin. The upload token no longer
// reaches this endpoint.
export async function POST() {
  return jsonError(410, "gone", {
    details: "Make a release current from /admin while signed in as an admin.",
  });
}
