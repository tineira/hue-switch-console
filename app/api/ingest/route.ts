import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const gone = {
  error: "gone",
  message:
    "POST /api/ingest is replaced by POST /api/device/register with a device API key. See docs/device-api.md",
};

export async function GET() {
  return jsonError(410, gone.error, { message: gone.message });
}

export async function POST() {
  return jsonError(410, gone.error, { message: gone.message });
}
