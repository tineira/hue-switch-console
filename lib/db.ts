import { createAdminClient } from "@/lib/supabase/admin";
import { formatMac } from "@/lib/mac";
import type {
  ApiKeyPublic,
  Channel,
  Recipe,
  SwitchPublic,
  TopologySnapshot,
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
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("device_api_keys")
    .select("id, user_id, name, key_prefix, created_at, revoked_at, last_used_at")
    .eq("key_hash", hash)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.revoked_at) return null;
  return data as DeviceApiKeyRow;
}

export async function touchApiKey(id: string) {
  const admin = createAdminClient();
  await admin
    .from("device_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", id);
}

export async function listApiKeys(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("device_api_keys")
    .select("id, user_id, name, key_prefix, created_at, revoked_at, last_used_at")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DeviceApiKeyRow[];
}

export async function insertApiKey(row: {
  userId: string;
  name: string;
  prefix: string;
  hash: string;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("device_api_keys")
    .insert({
      user_id: row.userId,
      name: row.name,
      key_prefix: row.prefix,
      key_hash: row.hash,
    })
    .select("id, user_id, name, key_prefix, created_at, revoked_at, last_used_at")
    .single();
  if (error) throw error;
  return data as DeviceApiKeyRow;
}

export async function revokeApiKey(userId: string, id: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("device_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", id)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function upsertBridge(row: {
  userId: string;
  snapshot: TopologySnapshot;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bridges")
    .upsert(
      {
        user_id: row.userId,
        bridgeid: row.snapshot.bridgeid,
        bridge_ip: row.snapshot.bridgeIp ?? null,
        snapshot: row.snapshot,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,bridgeid" },
    )
    .select("id, user_id, bridgeid, bridge_ip, snapshot, updated_at")
    .single();
  if (error) throw error;
  return data as BridgeRow;
}

export async function getBridge(userId: string, bridgeid: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bridges")
    .select("id, user_id, bridgeid, bridge_ip, snapshot, updated_at")
    .eq("user_id", userId)
    .eq("bridgeid", bridgeid)
    .maybeSingle();
  if (error) throw error;
  return (data as BridgeRow | null) ?? null;
}

export async function listBridges(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bridges")
    .select("id, user_id, bridgeid, bridge_ip, snapshot, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BridgeRow[];
}

export async function getSwitchByMac(userId: string, mac: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("switches")
    .select(
      "id, user_id, mac, label, firmware, bridgeid, bridge_ip, channels, api_key_id, rev, last_seen_at, created_at",
    )
    .eq("user_id", userId)
    .eq("mac", mac)
    .maybeSingle();
  if (error) throw error;
  return (data as SwitchRow | null) ?? null;
}

export async function listSwitches(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("switches")
    .select(
      "id, user_id, mac, label, firmware, bridgeid, bridge_ip, channels, api_key_id, rev, last_seen_at, created_at",
    )
    .eq("user_id", userId)
    .order("last_seen_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SwitchRow[];
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
  const admin = createAdminClient();
  const existing = await getSwitchByMac(row.userId, row.mac);
  const bridgeChanged = Boolean(existing && existing.bridgeid !== row.bridgeid);
  if (existing && bridgeChanged) {
    await admin.from("recipes").delete().eq("switch_id", existing.id);
  }

  const { data, error } = await admin
    .from("switches")
    .upsert(
      {
        user_id: row.userId,
        mac: row.mac,
        label: row.label ?? existing?.label ?? formatMac(row.mac),
        firmware: row.firmware ?? existing?.firmware ?? null,
        bridgeid: row.bridgeid,
        bridge_ip: row.bridgeIp ?? existing?.bridge_ip ?? null,
        channels: row.channels,
        api_key_id: row.apiKeyId,
        rev: bridgeChanged ? 0 : (existing?.rev ?? 0),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "user_id,mac" },
    )
    .select(
      "id, user_id, mac, label, firmware, bridgeid, bridge_ip, channels, api_key_id, rev, last_seen_at, created_at",
    )
    .single();
  if (error) throw error;
  return data as SwitchRow;
}

export async function touchSwitch(id: string) {
  const admin = createAdminClient();
  await admin
    .from("switches")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", id);
}

export async function listRecipes(switchId: string): Promise<Recipe[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("recipes")
    .select("channel_id, event, action, target_rtype, target_rid")
    .eq("switch_id", switchId);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    channelId: row.channel_id as string,
    event: row.event as Recipe["event"],
    action: row.action as Recipe["action"],
    target: {
      rtype: row.target_rtype as Recipe["target"]["rtype"],
      rid: row.target_rid as string,
    },
  }));
}

export async function replaceRecipes(switchId: string, recipes: Recipe[]) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("replace_switch_recipes", {
    p_switch_id: switchId,
    p_recipes: recipes,
  });
  if (error) throw error;
  return data as number;
}
