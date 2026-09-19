import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StoreFile, TopologySnapshot } from "./types";

const DATA_PATH = path.join(process.cwd(), "data", "topology.json");

function emptyStore(): StoreFile {
  return { snapshots: {} };
}

async function kvConfigured(): Promise<boolean> {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function kvRead(): Promise<StoreFile> {
  const res = await fetch(`${process.env.KV_REST_API_URL}/get/topology`, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) {
    return emptyStore();
  }
  const body = (await res.json()) as { result?: unknown };
  if (body.result == null) {
    return emptyStore();
  }
  if (typeof body.result === "string") {
    return JSON.parse(body.result) as StoreFile;
  }
  return body.result as StoreFile;
}

async function kvWrite(store: StoreFile): Promise<void> {
  await fetch(`${process.env.KV_REST_API_URL}/set/topology`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(JSON.stringify(store)),
  });
}

async function fileRead(): Promise<StoreFile> {
  try {
    const raw = await readFile(DATA_PATH, "utf8");
    return JSON.parse(raw) as StoreFile;
  } catch {
    return emptyStore();
  }
}

async function fileWrite(store: StoreFile): Promise<void> {
  await mkdir(path.dirname(DATA_PATH), { recursive: true });
  await writeFile(DATA_PATH, JSON.stringify(store, null, 2), "utf8");
}

export async function readStore(): Promise<StoreFile> {
  if (await kvConfigured()) {
    return kvRead();
  }
  return fileRead();
}

export async function saveSnapshot(snapshot: TopologySnapshot): Promise<void> {
  const store = await readStore();
  store.snapshots[snapshot.bridgeid] = snapshot;
  if (await kvConfigured()) {
    await kvWrite(store);
    return;
  }
  await fileWrite(store);
}

export async function listSnapshots(): Promise<TopologySnapshot[]> {
  const store = await readStore();
  return Object.values(store.snapshots).sort((a, b) =>
    a.bridgeid.localeCompare(b.bridgeid),
  );
}
