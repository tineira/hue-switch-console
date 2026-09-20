import { sql } from "@/lib/sql";
import type {
  Channel,
  Recipe,
  SwitchPublic,
  TopologySnapshot,
  ApiKeyPublic,
} from "@/lib/types";

export type DeviceApiKeyRow = {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
};

export type SwitchRow = {
  id: string;
  user_id: string;
  mac: string;
  label: string | null;
  firmware: string | null;
  bridgeid: string;
  bridge_ip: string | null;
  channels: Channel[];
  api_key_id: string | null;
  rev: number;
  last_seen_at: string | null;
  created_at: string;
};

export type BridgeRow = {
  id: string;
  user_id: string;
  bridgeid: string;
  bridge_ip: string | null;
  snapshot: TopologySnapshot;
  updated_at: string;
};

function asChannels(value: unknown): Channel[] {
  if (Array.isArray(value)) return value as Channel[];
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Channel[];
    } catch {
      return [];
    }
  }
  return [];
}

function asSnapshot(value: unknown): TopologySnapshot {
  if (value && typeof value === "object") return value as TopologySnapshot;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as TopologySnapshot;
    } catch {
      return { receivedAt: "", bridgeid: "", lights: [], rooms: [], scenes: [] };
    }
  }
  return { receivedAt: "", bridgeid: "", lights: [], rooms: [], scenes: [] };
}

function mapKey(row: Record<string, unknown>): DeviceApiKeyRow {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name: String(row.name),
    key_prefix: String(row.key_prefix),
    created_at: String(row.created_at),
    revoked_at: row.revoked_at ? String(row.revoked_at) : null,
    last_used_at: row.last_used_at ? String(row.last_used_at) : null,
  };
}

function mapSwitch(row: Record<string, unknown>): SwitchRow {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    mac: String(row.mac),
    label: row.label ? String(row.label) : null,
    firmware: row.firmware ? String(row.firmware) : null,
    bridgeid: String(row.bridgeid),
    bridge_ip: row.bridge_ip ? String(row.bridge_ip) : null,
    channels: asChannels(row.channels),
    api_key_id: row.api_key_id ? String(row.api_key_id) : null,
    rev: Number(row.rev) || 0,
    last_seen_at: row.last_seen_at ? String(row.last_seen_at) : null,
    created_at: String(row.created_at),
  };
}

function mapBridge(row: Record<string, unknown>): BridgeRow {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    bridgeid: String(row.bridgeid),
    bridge_ip: row.bridge_ip ? String(row.bridge_ip) : null,
    snapshot: asSnapshot(row.snapshot),
    updated_at: String(row.updated_at),
  };
}

export function toApiKeyPublic(row: DeviceApiKeyRow): ApiKeyPublic {
  return {
    id: row.id,
    name: row.name,
    prefix: row.key_prefix,
    created_at: row.created_at,
    last_used_at: row.last_used_at,
  };
}

export function toSwitchPublic(row: SwitchRow): SwitchPublic {
  return {
    mac: row.mac,
    label: row.label,
    firmware: row.firmware,
    bridgeid: row.bridgeid,
    bridge_ip: row.bridge_ip,
    channels: row.channels ?? [],
    rev: row.rev,
    last_seen_at: row.last_seen_at,
  };
}

export async function findActiveApiKeyByHash(hash: string) {
  const rows = await sql()`
    select id, user_id, name, key_prefix, created_at, revoked_at, last_used_at
    from device_api_keys
    where key_hash = ${hash} and revoked_at is null
    limit 1
  `;
  if (!rows[0]) return null;
  return mapKey(rows[0] as Record<string, unknown>);
}

export async function touchApiKey(id: string) {
  await sql()`update device_api_keys set last_used_at = now() where id = ${id}`;
}

export async function listApiKeys(userId: string) {
  const rows = await sql()`
    select id, user_id, name, key_prefix, created_at, revoked_at, last_used_at
    from device_api_keys
    where user_id = ${userId} and revoked_at is null
    order by created_at desc
  `;
  return rows.map((row) => mapKey(row as Record<string, unknown>));
}

export async function insertApiKey(row: {
  userId: string;
  name: string;
  prefix: string;
  hash: string;
}) {
  const rows = await sql()`
    insert into device_api_keys (user_id, name, key_prefix, key_hash)
    values (${row.userId}, ${row.name}, ${row.prefix}, ${row.hash})
    returning id, user_id, name, key_prefix, created_at, revoked_at, last_used_at
  `;
  return mapKey(rows[0] as Record<string, unknown>);
}

export async function revokeApiKey(userId: string, id: string) {
  const rows = await sql()`
    update device_api_keys
    set revoked_at = now()
    where user_id = ${userId} and id = ${id} and revoked_at is null
    returning id
  `;
  return rows.length > 0;
}

export async function upsertBridge(row: {
  userId: string;
  snapshot: TopologySnapshot;
}) {
  const payload = JSON.stringify(row.snapshot);
  const rows = await sql()`
    insert into bridges (user_id, bridgeid, bridge_ip, snapshot, updated_at)
    values (${row.userId}, ${row.snapshot.bridgeid}, ${row.snapshot.bridgeIp ?? null}, ${payload}::jsonb, now())
    on conflict (user_id, bridgeid) do update set
      bridge_ip = excluded.bridge_ip,
      snapshot = excluded.snapshot,
      updated_at = now()
    returning id, user_id, bridgeid, bridge_ip, snapshot, updated_at
  `;
  return mapBridge(rows[0] as Record<string, unknown>);
}

export async function getBridge(userId: string, bridgeid: string) {
  const rows = await sql()`
    select id, user_id, bridgeid, bridge_ip, snapshot, updated_at
    from bridges
    where user_id = ${userId} and bridgeid = ${bridgeid}
    limit 1
  `;
  if (!rows[0]) return null;
  return mapBridge(rows[0] as Record<string, unknown>);
}

export async function listBridges(userId: string) {
  const rows = await sql()`
    select id, user_id, bridgeid, bridge_ip, snapshot, updated_at
    from bridges
    where user_id = ${userId}
    order by updated_at desc
  `;
  return rows.map((row) => mapBridge(row as Record<string, unknown>));
}

export async function getSwitchByMac(userId: string, mac: string) {
  const rows = await sql()`
    select id, user_id, mac, label, firmware, bridgeid, bridge_ip, channels,
           api_key_id, rev, last_seen_at, created_at
    from switches
    where user_id = ${userId} and mac = ${mac}
    limit 1
  `;
  if (!rows[0]) return null;
  return mapSwitch(rows[0] as Record<string, unknown>);
}

export async function listSwitches(userId: string) {
  const rows = await sql()`
    select id, user_id, mac, label, firmware, bridgeid, bridge_ip, channels,
           api_key_id, rev, last_seen_at, created_at
    from switches
    where user_id = ${userId}
    order by last_seen_at desc nulls last
  `;
  return rows.map((row) => mapSwitch(row as Record<string, unknown>));
}

export async function upsertSwitch(row: {
  userId: string;
  mac: string;
  label?: string;
  firmware?: string;
  bridgeid: string;
  bridgeIp?: string;
  channels: Channel[];
  apiKeyId: string;
}) {
  const existing = await getSwitchByMac(row.userId, row.mac);
  const bridgeChanged = Boolean(existing && existing.bridgeid !== row.bridgeid);
  if (existing && bridgeChanged) {
    await sql()`delete from recipes where switch_id = ${existing.id}`;
  }
  const label = existing?.label ?? row.label ?? null;
  const firmware = row.firmware ?? existing?.firmware ?? null;
  const bridgeIp = row.bridgeIp ?? existing?.bridge_ip ?? null;
  const rev = bridgeChanged ? 0 : (existing?.rev ?? 0);
  const channels = JSON.stringify(row.channels);
  const rows = await sql()`
    insert into switches (
      user_id, mac, label, firmware, bridgeid, bridge_ip, channels, api_key_id, rev, last_seen_at
    )
    values (
      ${row.userId}, ${row.mac}, ${label}, ${firmware}, ${row.bridgeid}, ${bridgeIp},
      ${channels}::jsonb, ${row.apiKeyId}, ${rev}, now()
    )
    on conflict (user_id, mac) do update set
      firmware = excluded.firmware,
      bridgeid = excluded.bridgeid,
      bridge_ip = excluded.bridge_ip,
      channels = excluded.channels,
      api_key_id = excluded.api_key_id,
      rev = excluded.rev,
      last_seen_at = now()
    returning id, user_id, mac, label, firmware, bridgeid, bridge_ip, channels,
              api_key_id, rev, last_seen_at, created_at
  `;
  return mapSwitch(rows[0] as Record<string, unknown>);
}

export async function updateSwitchLabel(
  userId: string,
  mac: string,
  label: string | null,
) {
  const rows = await sql()`
    update switches
    set label = ${label}
    where user_id = ${userId} and mac = ${mac}
    returning id, user_id, mac, label, firmware, bridgeid, bridge_ip, channels,
              api_key_id, rev, last_seen_at, created_at
  `;
  if (!rows[0]) return null;
  return mapSwitch(rows[0] as Record<string, unknown>);
}

export async function touchSwitch(id: string) {
  await sql()`update switches set last_seen_at = now() where id = ${id}`;
}

export async function listRecipes(switchId: string): Promise<Recipe[]> {
  const rows = await sql()`
    select channel_id, event, action, target_rtype, target_rid
    from recipes
    where switch_id = ${switchId}
  `;
  return rows.map((row) => {
    const rec = row as Record<string, unknown>;
    return {
      channelId: String(rec.channel_id),
      event: rec.event as Recipe["event"],
      action: rec.action as Recipe["action"],
      target: {
        rtype: rec.target_rtype as Recipe["target"]["rtype"],
        rid: String(rec.target_rid),
      },
    };
  });
}

export async function replaceRecipes(switchId: string, recipes: Recipe[]) {
  await sql()`delete from recipes where switch_id = ${switchId}`;
  for (const rec of recipes) {
    await sql()`
      insert into recipes (switch_id, channel_id, event, action, target_rtype, target_rid)
      values (
        ${switchId}, ${rec.channelId}, ${rec.event}, ${rec.action},
        ${rec.target.rtype}, ${rec.target.rid}
      )
    `;
  }
  const rows = await sql()`
    update switches set rev = rev + 1 where id = ${switchId} returning rev
  `;
  return Number((rows[0] as { rev: number }).rev);
}
