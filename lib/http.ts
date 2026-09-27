import { NextResponse } from "next/server";

export function jsonError(
  status: number,
  error: string,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json({ error, ...extra }, { status });
}

export function jsonOk(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  const token = header.slice(7).trim();
  return token || null;
}

// A failed query stays in the server log; the client gets only the code, not our schema.
export function databaseError(err: unknown) {
  console.error(err);
  return jsonError(500, "database_error");
}
