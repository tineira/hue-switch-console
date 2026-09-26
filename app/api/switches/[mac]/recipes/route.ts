import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

// Simple recipes are derived from channel settings (docs/specs/simple-channel-types.md).
function gone() {
  return jsonError(410, "gone", {
    details: "Use /api/switches/{mac}/channels (Simple) or /api/switches/{mac}/pages (Round)",
  });
}

export const GET = gone;
export const PUT = gone;
