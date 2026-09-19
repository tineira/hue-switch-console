import { NextRequest, NextResponse } from "next/server";
import { listSnapshots, saveSnapshot } from "@/lib/store";
import type { IngestPayload, Light, Room } from "@/lib/types";

export const dynamic = "force-dynamic";

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function checkToken(req: NextRequest): boolean {
  const expected = process.env.INGEST_TOKEN;
  if (!expected) {
    return false;
  }
  const header = req.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : header.trim();
  return token === expected;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseLights(raw: unknown): Light[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }
  const lights: Light[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      return null;
    }
    const row = item as Record<string, unknown>;
    const id = asString(row.id);
    const name = asString(row.name);
    if (!id || !name) {
      return null;
    }
    const caps = Array.isArray(row.caps)
      ? row.caps.filter((c): c is string => typeof c === "string")
      : undefined;
    lights.push({
      id,
      name,
      on: typeof row.on === "boolean" ? row.on : undefined,
      caps,
    });
  }
  return lights;
}

function parseRooms(raw: unknown): Room[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const rooms: Room[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const row = item as Record<string, unknown>;
    const id = asString(row.id);
    const name = asString(row.name);
    if (id && name) {
      rooms.push({ id, name });
    }
  }
  return rooms;
}

export async function GET(req: NextRequest) {
  if (!checkToken(req)) {
    return unauthorized();
  }
  const snapshots = await listSnapshots();
  return NextResponse.json({ snapshots });
}

export async function POST(req: NextRequest) {
  if (!process.env.INGEST_TOKEN) {
    return NextResponse.json(
      { error: "INGEST_TOKEN is not set" },
      { status: 503 },
    );
  }
  if (!checkToken(req)) {
    return unauthorized();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const raw = body as IngestPayload;
  const bridgeid = asString(raw.bridgeid);
  const lights = parseLights(raw.lights);
  if (!bridgeid || !lights) {
    return NextResponse.json(
      { error: "bridgeid and lights[] with id,name are required" },
      { status: 400 },
    );
  }

  await saveSnapshot({
    receivedAt: new Date().toISOString(),
    bridgeid,
    bridgeIp: asString(raw.bridge_ip),
    source: asString(raw.source) ?? "unknown",
    lights,
    rooms: parseRooms(raw.rooms),
  });

  return NextResponse.json({ ok: true, bridgeid, lights: lights.length });
}
