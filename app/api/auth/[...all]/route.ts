import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/better-auth";
import { ensureSchema } from "@/lib/ensure-schema";

export const dynamic = "force-dynamic";

// Only the OAuth return trip is served over HTTP. Every other sign-in step runs in
// server actions, which apply Turnstile and the send limits first (§2.2, §2.5).
const PUBLIC = [/^\/api\/auth\/callback\/[a-z]+$/, /^\/api\/auth\/error$/];

async function handle(req: Request, method: "GET" | "POST") {
  const path = new URL(req.url).pathname;
  if (!PUBLIC.some((pattern) => pattern.test(path))) {
    return new Response("Not Found", { status: 404 });
  }
  await ensureSchema();
  return toNextJsHandler(auth())[method](req);
}

export async function GET(req: Request) {
  return handle(req, "GET");
}

export async function POST(req: Request) {
  return handle(req, "POST");
}
