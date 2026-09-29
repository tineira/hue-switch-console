import {
  computeDim,
  decideSwitchProduct,
  DEFAULT_SCREEN_TIMEOUT_SEC,
  dimsEqual,
  groupsEqual,
  inferPageGroup,
  isPlaceholderRoundChannels,
  normalizePageName,
  recipeToC1,
  resolvePageGroup,
  withSceneNames,
} from "@/lib/pages";
import { configStatus } from "@/lib/config-sync";
import { accountLimitLockKey } from "@/lib/limits";
import { otaCapable } from "@/lib/ota";
import { snapshotFromJson } from "@/lib/recipes";
import { sql } from "@/lib/sql";
import type {
  Channel,
  DimSet,
  PageGroup,
  PageSwipeAxis,
  Recipe,
  RoundRecipe,
  SceneListItem,
  SimpleChannelConfig,
  SimpleGesture,
  SwitchPage,
  SwitchProduct,
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
  last_switch_mac?: string | null;
  last_switch_label?: string | null;
  last_switch_bridgeid?: string | null;
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
  product: SwitchProduct;
  page_swipe_axis: PageSwipeAxis;
  page_seq: number;
  screen_timeout_sec: number;
  applied_rev: number | null;
  served_rev: number | null;
  apply_failed: boolean;
  rev_changed_at: string | null;
  editing_until: string | null;
  next_poll_at: string | null;
  firmware_seen_at: string | null;
  ota_offered_at: string | null;
  ota_error: string | null;
  ota_error_at: string | null;
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
    last_switch_mac: row.last_switch_mac ? String(row.last_switch_mac) : null,
    last_switch_label: row.last_switch_label ? String(row.last_switch_label) : null,
    last_switch_bridgeid: row.last_switch_bridgeid ? String(row.last_switch_bridgeid) : null,
  };
}

function asScreenTimeoutSec(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    return DEFAULT_SCREEN_TIMEOUT_SEC;
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n)) return DEFAULT_SCREEN_TIMEOUT_SEC;
  return n;
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
    product: row.product === "round" ? "round" : "simple",
    page_swipe_axis: row.page_swipe_axis === "vertical" ? "vertical" : "horizontal",
    page_seq: Number(row.page_seq) || 1,
    screen_timeout_sec: asScreenTimeoutSec(row.screen_timeout_sec),
    applied_rev: asRevOrNull(row.applied_rev),
    served_rev: asRevOrNull(row.served_rev),
    apply_failed: row.apply_failed === true,
    rev_changed_at: row.rev_changed_at ? String(row.rev_changed_at) : null,
    editing_until: row.editing_until ? String(row.editing_until) : null,
    next_poll_at: row.next_poll_at ? String(row.next_poll_at) : null,
    firmware_seen_at: row.firmware_seen_at ? String(row.firmware_seen_at) : null,
    ota_offered_at: row.ota_offered_at ? String(row.ota_offered_at) : null,
    ota_error: row.ota_error ? String(row.ota_error) : null,
    ota_error_at: row.ota_error_at ? String(row.ota_error_at) : null,
  };
}

function asRevOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
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
    last_switch_mac: row.last_switch_mac ?? null,
    last_switch_label: row.last_switch_label ?? null,
    last_switch_bridgeid: row.last_switch_bridgeid ?? null,
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
    product: row.product,
    pageSwipeAxis: row.page_swipe_axis,
    screenTimeoutSec: row.screen_timeout_sec,
    applied_rev: row.applied_rev,
    config_status: configStatus(row),
    rev_changed_at: row.rev_changed_at,
    next_poll_at: row.next_poll_at,
    firmware_seen_at: row.firmware_seen_at,
    ota_capable: otaCapable(row),
    ota_offered_at: row.ota_offered_at,
    ota_error: row.ota_error,
    ota_error_at: row.ota_error_at,
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

// A switch remembers the key it last used; true when that key has since been revoked.
export async function isApiKeyRevoked(id: string): Promise<boolean> {
  const rows = await sql()`
    select revoked_at from device_api_keys where id = ${id} limit 1
  `;
  return Boolean(rows[0] && (rows[0] as Record<string, unknown>).revoked_at);
}

export async function touchApiKey(id: string) {
  await sql()`update device_api_keys set last_used_at = now() where id = ${id}`;
}

export async function listApiKeys(userId: string) {
  const rows = await sql()`
    select k.id, k.user_id, k.name, k.key_prefix, k.created_at, k.revoked_at, k.last_used_at,
           s.mac as last_switch_mac, s.label as last_switch_label,
           s.bridgeid as last_switch_bridgeid
    from device_api_keys k
    left join lateral (
      select mac, label, bridgeid
      from switches
      where api_key_id = k.id
      order by last_seen_at desc nulls last
      limit 1
    ) s on true
    where k.user_id = ${userId} and k.revoked_at is null
    order by k.created_at desc
  `;
  return rows.map((row) => mapKey(row as Record<string, unknown>));
}

/**
 * A new key, or null when the account already has `limit` active keys. The count and the
 * insert run in one transaction under the account lock, so parallel requests cannot pass it.
 */
export async function insertApiKey(row: {
  userId: string;
  name: string;
  prefix: string;
  hash: string;
  limit: number;
}) {
  const lockKey = accountLimitLockKey(row.userId);
  const results = await sql().transaction((tx) => [
    tx`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`,
    tx`
      insert into device_api_keys (user_id, name, key_prefix, key_hash)
      select ${row.userId}, ${row.name}, ${row.prefix}, ${row.hash}
      where (
        select count(*) from device_api_keys where user_id = ${row.userId} and revoked_at is null
      ) < ${row.limit}
      returning id, user_id, name, key_prefix, created_at, revoked_at, last_used_at
    `,
  ]);
  const inserted = results[1]?.[0];
  return inserted ? mapKey(inserted as Record<string, unknown>) : null;
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

/**
 * Stores the register's snapshot for (user, bridgeid). A snapshot with no lights never
 * replaces a stored one that has lights (a Bridge that answered 200 with empty data):
 * the stored tree is kept and `kept` is true. The check runs inside the upsert, so two
 * registers racing cannot interleave between a read and a write.
 */
export async function upsertBridge(row: {
  userId: string;
  snapshot: TopologySnapshot;
}): Promise<BridgeRow & { kept: boolean }> {
  const payload = JSON.stringify(row.snapshot);
  const rows = await sql()`
    insert into bridges (user_id, bridgeid, bridge_ip, snapshot, updated_at)
    values (${row.userId}, ${row.snapshot.bridgeid}, ${row.snapshot.bridgeIp ?? null}, ${payload}::jsonb, now())
    on conflict (user_id, bridgeid) do update set
      bridge_ip = excluded.bridge_ip,
      snapshot = case
        when jsonb_typeof(excluded.snapshot->'lights') = 'array'
          and jsonb_array_length(excluded.snapshot->'lights') = 0
          and jsonb_typeof(bridges.snapshot->'lights') = 'array'
          and jsonb_array_length(bridges.snapshot->'lights') > 0
        then bridges.snapshot
        else excluded.snapshot
      end,
      updated_at = now()
    returning id, user_id, bridgeid, bridge_ip, snapshot, updated_at,
      (snapshot->>'receivedAt') is distinct from ${row.snapshot.receivedAt} as kept
  `;
  const r = rows[0] as Record<string, unknown>;
  return { ...mapBridge(r), kept: r.kept === true };
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
           api_key_id, rev, last_seen_at, created_at, product, page_swipe_axis, page_seq,
           screen_timeout_sec, applied_rev, served_rev, apply_failed, rev_changed_at,
           editing_until, next_poll_at, firmware_seen_at, ota_offered_at, ota_error, ota_error_at
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
           api_key_id, rev, last_seen_at, created_at, product, page_swipe_axis, page_seq,
           screen_timeout_sec, applied_rev, served_rev, apply_failed, rev_changed_at,
           editing_until, next_poll_at, firmware_seen_at, ota_offered_at, ota_error, ota_error_at
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
  product?: SwitchProduct;
}) {
  const existing = await getSwitchByMac(row.userId, row.mac);
  const { product, wipeToSimple } = decideSwitchProduct({
    requested: row.product,
    channels: row.channels,
    existing,
  });
  const bridgeChanged = Boolean(existing && existing.bridgeid !== row.bridgeid);
  if (existing && (bridgeChanged || wipeToSimple)) {
    await sql()`delete from recipes where switch_id = ${existing.id}`;
    await sql()`delete from pages where switch_id = ${existing.id}`;
    await sql()`delete from simple_channels where switch_id = ${existing.id}`;
  }
  const label = existing?.label ?? row.label ?? null;
  const firmware = row.firmware ?? existing?.firmware ?? null;
  const bridgeIp = row.bridgeIp ?? existing?.bridge_ip ?? null;
  const rev =
    bridgeChanged || wipeToSimple
      ? (existing?.rev ?? 0) + 1
      : (existing?.rev ?? 0);
  const channels = JSON.stringify(row.channels);
  const axis =
    product === "round"
      ? (existing && !bridgeChanged ? existing.page_swipe_axis : "horizontal")
      : "horizontal";
  const pageSeq =
    product === "round" && existing && !bridgeChanged ? existing.page_seq : 1;
  const screenTimeoutSec =
    product === "round" && existing && !bridgeChanged
      ? existing.screen_timeout_sec
      : DEFAULT_SCREEN_TIMEOUT_SEC;
  const rows = await sql()`
    insert into switches (
      user_id, mac, label, firmware, bridgeid, bridge_ip, channels, api_key_id, rev, last_seen_at,
      product, page_swipe_axis, page_seq, screen_timeout_sec, firmware_seen_at
    )
    values (
      ${row.userId}, ${row.mac}, ${label}, ${firmware}, ${row.bridgeid}, ${bridgeIp},
      ${channels}::jsonb, ${row.apiKeyId}, ${rev}, now(),
      ${product}, ${axis}, ${pageSeq}, ${screenTimeoutSec},
      case when ${row.firmware ?? null}::text is null then null else now() end
    )
    on conflict (user_id, mac) do update set
      firmware = excluded.firmware,
      firmware_seen_at = coalesce(excluded.firmware_seen_at, switches.firmware_seen_at),
      bridgeid = excluded.bridgeid,
      bridge_ip = excluded.bridge_ip,
      channels = excluded.channels,
      api_key_id = excluded.api_key_id,
      rev = excluded.rev,
      rev_changed_at = case
        when excluded.rev is distinct from switches.rev then now()
        else switches.rev_changed_at
      end,
      last_seen_at = now(),
      product = excluded.product,
      page_swipe_axis = excluded.page_swipe_axis,
      page_seq = excluded.page_seq,
      screen_timeout_sec = excluded.screen_timeout_sec
    returning id, user_id, mac, label, firmware, bridgeid, bridge_ip, channels,
              api_key_id, rev, last_seen_at, created_at, product, page_swipe_axis, page_seq,
              screen_timeout_sec, applied_rev, served_rev, apply_failed, rev_changed_at,
              editing_until, next_poll_at, firmware_seen_at, ota_offered_at, ota_error, ota_error_at
  `;
  const sw = mapSwitch(rows[0] as Record<string, unknown>);
  if (sw.product === "round") {
    await ensureDefaultRoundPage(sw.id);
    await migrateC1RecipesForSwitch(sw.id, sw.user_id, sw.bridgeid);
  }
  return sw;
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
              api_key_id, rev, last_seen_at, created_at, product, page_swipe_axis, page_seq,
              screen_timeout_sec, applied_rev, served_rev, apply_failed, rev_changed_at,
              editing_until, next_poll_at, firmware_seen_at, ota_offered_at, ota_error, ota_error_at
  `;
  if (!rows[0]) return null;
  return mapSwitch(rows[0] as Record<string, unknown>);
}

export async function touchSwitch(id: string, apiKeyId: string) {
  await sql()`
    update switches set last_seen_at = now(), api_key_id = ${apiKeyId}
    where id = ${id}
  `;
}

/**
 * One config poll (docs/specs/finished/config-sync.md §4.2): what the switch reported, what it
 * was served, and when it is next expected. `reported` null leaves the applied
 * revision and the failure flag as they were (firmware that does not send `rev`).
 */
export async function recordConfigPoll(input: {
  id: string;
  apiKeyId: string;
  reported: number | null;
  applyFailed: boolean;
  servedRev: number;
  pollSec: number;
  /** The `firmware` the poll reported; null keeps the stored one (docs/specs/finished/ota.md §2.1). */
  firmware: string | null;
  otaError: string | null;
  /** The switch runs the current release: the offer is done (§3.2). */
  otaDone: boolean;
}) {
  await sql()`
    update switches
    set last_seen_at = now(),
        api_key_id = ${input.apiKeyId},
        firmware = coalesce(${input.firmware}::text, firmware),
        firmware_seen_at = case
          when ${input.firmware}::text is null then firmware_seen_at
          else now()
        end,
        ota_offered_at = case when ${input.otaDone} then null else ota_offered_at end,
        ota_error = case
          when ${input.otaDone} then null
          else coalesce(${input.otaError}::text, ota_error)
        end,
        ota_error_at = case
          when ${input.otaDone} then null
          when ${input.otaError}::text is null then ota_error_at
          else now()
        end,
        applied_rev = coalesce(${input.reported}::integer, applied_rev),
        apply_failed = case
          when ${input.reported}::integer is null then apply_failed
          else ${input.applyFailed}
        end,
        served_rev = ${input.servedRev},
        next_poll_at = now() + make_interval(secs => ${input.pollSec})
    where id = ${input.id}
  `;
}

/** Offers the current release to these switches, or cancels their offers (docs/specs/finished/ota.md §2.4). */
export async function setOtaOffer(userId: string, switchIds: string[], offered: boolean) {
  if (switchIds.length === 0) return;
  await sql()`
    update switches
    set ota_offered_at = case when ${offered} then now() else null end,
        ota_error = null,
        ota_error_at = null
    where user_id = ${userId} and id = any(${switchIds}::uuid[])
  `;
}

/** Moves `rev` past a revision the switch holds, so the console's config wins (§4.4). */
export async function bumpSwitchRevPast(switchId: string, past: number): Promise<number> {
  const rows = await sql()`
    update switches
    set rev = greatest(rev, ${past}::integer + 1), rev_changed_at = now()
    where id = ${switchId}
    returning rev
  `;
  return Number((rows[0] as { rev: number }).rev);
}

/** The person has the Switches area open: every switch of theirs polls fast for a while. */
export async function markSwitchesEditing(userId: string, minutes: number) {
  await sql()`
    update switches
    set editing_until = now() + make_interval(mins => ${minutes})
    where user_id = ${userId}
  `;
}

export async function markSwitchEditing(switchId: string, minutes: number) {
  await sql()`
    update switches
    set editing_until = now() + make_interval(mins => ${minutes})
    where id = ${switchId}
  `;
}

function asSimpleGesture(value: unknown): SimpleGesture | null {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (row.action === "recall_scene") {
    const targets = asTargets(row.targets);
    return targets.length > 0 ? { action: "recall_scene", targets } : null;
  }
  const target = row.target as Record<string, unknown> | undefined;
  if (
    (row.action === "on" ||
      row.action === "off" ||
      row.action === "toggle" ||
      row.action === "dim") &&
    target &&
    (target.rtype === "light" || target.rtype === "grouped_light") &&
    typeof target.rid === "string"
  ) {
    return { action: row.action, target: { rtype: target.rtype, rid: target.rid } };
  }
  return null;
}

function mapSimpleChannel(row: Record<string, unknown>): SimpleChannelConfig {
  return {
    id: String(row.channel_id),
    kind: row.kind === "momentary" ? "momentary" : "maintained",
    group: {
      rtype: row.group_rtype === "zone" ? "zone" : "room",
      rid: String(row.group_rid),
      groupedLightRid: String(row.grouped_light_rid),
    },
    target: {
      rtype: row.target_rtype === "light" ? "light" : "grouped_light",
      rid: String(row.target_rid),
    },
    scenes: asTargets(row.scenes),
    double: asSimpleGesture(row.double_click),
    hold: asSimpleGesture(row.hold),
    label: typeof row.label === "string" && row.label ? row.label : null,
  };
}

export async function listSimpleChannels(
  switchId: string,
): Promise<SimpleChannelConfig[]> {
  const rows = await sql()`
    select channel_id, kind, group_rtype, group_rid, grouped_light_rid,
           target_rtype, target_rid, scenes, double_click, hold, label
    from simple_channels
    where switch_id = ${switchId}
    order by channel_id asc
  `;
  return rows.map((row) => mapSimpleChannel(row as Record<string, unknown>));
}

export async function replaceSimpleChannels(
  switchId: string,
  configs: SimpleChannelConfig[],
) {
  await sql()`delete from simple_channels where switch_id = ${switchId}`;
  for (const config of configs) {
    await sql()`
      insert into simple_channels (
        switch_id, channel_id, kind, group_rtype, group_rid, grouped_light_rid,
        target_rtype, target_rid, scenes, double_click, hold, label
      )
      values (
        ${switchId}, ${config.id}, ${config.kind}, ${config.group.rtype},
        ${config.group.rid}, ${config.group.groupedLightRid},
        ${config.target.rtype}, ${config.target.rid},
        ${JSON.stringify(config.scenes)}::jsonb,
        ${config.double ? JSON.stringify(config.double) : null}::jsonb,
        ${config.hold ? JSON.stringify(config.hold) : null}::jsonb,
        ${config.label}
      )
    `;
  }
  return incrementSwitchRev(switchId);
}

/**
 * Simple recipes from before channel types (on/off/double_click/short per slot)
 * cannot be expressed as channel settings; the user approved deleting them
 * (docs/specs/finished/simple-channel-types.md §3). Idempotent: only switches that still
 * had rows get a rev bump, so their next poll replaces the old set with nothing.
 */
export async function dropLegacySimpleRecipes() {
  await sql()`
    with gone as (
      delete from recipes r
      using switches s
      where r.switch_id = s.id
        and s.product = 'simple'
        and r.page_id is null
        and r.channel_id is distinct from 'c1'
      returning r.switch_id
    )
    update switches set rev = rev + 1, rev_changed_at = now()
    where id in (select distinct switch_id from gone)
  `;
}

function asTargets(value: unknown): SceneListItem[] {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  const items: SceneListItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const rid = typeof row.rid === "string" ? row.rid : "";
    if (!rid) continue;
    items.push({
      rtype: "scene",
      rid,
      name: typeof row.name === "string" ? row.name : "",
    });
  }
  return items;
}

function asDim(value: unknown): DimSet | null {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (row.mode === "group" && typeof row.rid === "string" && row.rid) {
    return { mode: "group", rid: row.rid };
  }
  if (row.mode === "lights" && Array.isArray(row.rids)) {
    const rids = row.rids.filter(
      (item): item is string => typeof item === "string" && item.length > 0,
    );
    if (rids.length === 0) return null;
    return { mode: "lights", rids };
  }
  return null;
}

function asPageGroup(row: Record<string, unknown>): PageGroup | null {
  const rtype = row.group_rtype;
  const rid = row.group_rid ? String(row.group_rid) : "";
  const groupedLightRid = row.grouped_light_rid
    ? String(row.grouped_light_rid)
    : "";
  if ((rtype !== "room" && rtype !== "zone") || !rid || !groupedLightRid) {
    return null;
  }
  return { rtype, rid, groupedLightRid };
}

function dimJson(dim: DimSet | null): string | null {
  return dim ? JSON.stringify(dim) : null;
}

function mapPage(row: Record<string, unknown>): SwitchPage {
  return {
    id: String(row.id),
    name: String(row.name),
    sortOrder: Number(row.sort_order) || 0,
    theme: String(row.theme || "ember"),
    group: asPageGroup(row),
    dim: asDim(row.dim),
  };
}

function mapRoundRecipe(row: Record<string, unknown>): RoundRecipe {
  const action = row.action as RoundRecipe["action"];
  const event = row.event === "double_click" ? "double_click" : "short";
  const pageId = String(row.page_id);
  if (action === "recall_scene") {
    const fromJson = asTargets(row.targets);
    const targets =
      fromJson.length > 0
        ? fromJson
        : [
            {
              rtype: "scene" as const,
              rid: String(row.target_rid),
              name: "",
            },
          ];
    return { pageId, event, action: "recall_scene", targets };
  }
  return {
    pageId,
    event,
    action,
    target: {
      rtype: row.target_rtype as Recipe["target"]["rtype"],
      rid: String(row.target_rid),
    },
  };
}

export async function listPages(switchId: string): Promise<SwitchPage[]> {
  const rows = await sql()`
    select id, name, sort_order, theme,
           group_rtype, group_rid, grouped_light_rid, dim
    from pages
    where switch_id = ${switchId}
    order by sort_order asc, id asc
  `;
  return rows.map((row) => mapPage(row as Record<string, unknown>));
}

export async function listRoundRecipes(switchId: string): Promise<RoundRecipe[]> {
  const rows = await sql()`
    select page_id, event, action, target_rtype, target_rid, targets
    from recipes
    where switch_id = ${switchId} and page_id is not null
  `;
  return rows.map((row) => mapRoundRecipe(row as Record<string, unknown>));
}

export async function ensureDefaultRoundPage(switchId: string): Promise<SwitchPage[]> {
  const pages = await listPages(switchId);
  if (pages.length > 0) return pages;
  await sql()`
    insert into pages (switch_id, id, name, sort_order, theme)
    values (${switchId}, 'p1', 'Page 1', 0, 'ember')
  `;
  await sql()`
    update switches set page_seq = greatest(page_seq, 2) where id = ${switchId}
  `;
  return listPages(switchId);
}

async function snapshotForSwitch(
  userId: string,
  bridgeid: string,
): Promise<TopologySnapshot | null> {
  const rows = await sql()`
    select snapshot from bridges
    where user_id = ${userId} and bridgeid = ${bridgeid}
    limit 1
  `;
  if (!rows[0]) return null;
  return snapshotFromJson((rows[0] as { snapshot: unknown }).snapshot);
}

function withGroupAndDim(
  page: SwitchPage,
  recipes: RoundRecipe[],
  snapshot: TopologySnapshot | null,
): SwitchPage {
  const pageRecipes = recipes.filter((recipe) => recipe.pageId === page.id);
  const group = snapshot
    ? (resolvePageGroup(snapshot, page.group) ??
      inferPageGroup(pageRecipes, snapshot) ??
      page.group)
    : page.group;
  return {
    ...page,
    group,
    dim: computeDim(pageRecipes, group?.groupedLightRid, snapshot),
  };
}

export async function persistPageGroupAndDim(
  switchId: string,
  pages: SwitchPage[],
  recipes: RoundRecipe[],
  snapshot: TopologySnapshot | null,
): Promise<boolean> {
  let changed = false;
  for (const page of pages) {
    const next = withGroupAndDim(page, recipes, snapshot);
    if (groupsEqual(page.group, next.group) && dimsEqual(page.dim, next.dim)) {
      continue;
    }
    changed = true;
    await sql()`
      update pages
      set group_rtype = ${next.group?.rtype ?? null},
          group_rid = ${next.group?.rid ?? null},
          grouped_light_rid = ${next.group?.groupedLightRid ?? null},
          dim = ${dimJson(next.dim)}::jsonb
      where switch_id = ${switchId} and id = ${page.id}
    `;
  }
  return changed;
}

export async function incrementSwitchRev(switchId: string): Promise<number> {
  const rows = await sql()`
    update switches set rev = rev + 1, rev_changed_at = now()
    where id = ${switchId}
    returning rev
  `;
  return Number((rows[0] as { rev: number }).rev);
}

async function migrateC1RecipesForSwitch(
  switchId: string,
  userId: string,
  bridgeid: string,
) {
  const c1 = await sql()`
    select channel_id, event, action, target_rtype, target_rid
    from recipes
    where switch_id = ${switchId} and channel_id = 'c1' and page_id is null
  `;
  if (c1.length === 0) return false;
  await ensureDefaultRoundPage(switchId);
  const snapshot = await snapshotForSwitch(userId, bridgeid);
  for (const row of c1) {
    const rec = row as Record<string, unknown>;
    const simple: Recipe = {
      channelId: "c1",
      event: rec.event as Recipe["event"],
      action: rec.action as Recipe["action"],
      target: {
        rtype: rec.target_rtype as Recipe["target"]["rtype"],
        rid: String(rec.target_rid),
      },
    };
    const round = recipeToC1(simple);
    if (snapshot && round.targets) {
      round.targets = withSceneNames([round], snapshot)[0].targets;
    }
    const existing = await sql()`
      select id from recipes
      where switch_id = ${switchId} and page_id = ${round.pageId} and event = ${round.event}
      limit 1
    `;
    if (existing.length === 0) {
      await insertRoundRecipe(switchId, round);
    }
  }
  await sql()`
    delete from recipes
    where switch_id = ${switchId} and channel_id = 'c1' and page_id is null
  `;
  const pages = await listPages(switchId);
  const recipes = await listRoundRecipes(switchId);
  await persistPageGroupAndDim(switchId, pages, recipes, snapshot);
  await sql()`update switches set rev = rev + 1, rev_changed_at = now(), product = 'round' where id = ${switchId}`;
  return true;
}

async function insertRoundRecipe(switchId: string, recipe: RoundRecipe) {
  if (recipe.action === "recall_scene") {
    const targets = recipe.targets ?? [];
    const first = targets[0];
    if (!first) return;
    const payload = JSON.stringify(targets);
    await sql()`
      insert into recipes (
        switch_id, page_id, event, action, target_rtype, target_rid, targets
      )
      values (
        ${switchId}, ${recipe.pageId}, ${recipe.event}, ${recipe.action},
        ${first.rtype}, ${first.rid}, ${payload}::jsonb
      )
    `;
    return;
  }
  const target = recipe.target;
  if (!target) return;
  await sql()`
    insert into recipes (
      switch_id, page_id, event, action, target_rtype, target_rid
    )
    values (
      ${switchId}, ${recipe.pageId}, ${recipe.event}, ${recipe.action},
      ${target.rtype}, ${target.rid}
    )
  `;
}

function nextPageSeqFromIds(ids: string[], current: number): number {
  let maxN = current - 1;
  for (const id of ids) {
    const match = /^p([1-9][0-9]*)$/.exec(id);
    if (!match) continue;
    const n = Number(match[1]);
    if (n > maxN) maxN = n;
  }
  return maxN + 1;
}

export async function replaceRoundConfig(
  sw: SwitchRow,
  input: {
    pageSwipeAxis: PageSwipeAxis;
    screenTimeoutSec: number;
    pages: SwitchPage[];
    recipes: RoundRecipe[];
    snapshot: TopologySnapshot;
  },
) {
  const existing = await listPages(sw.id);
  const existingIds = new Set(existing.map((page) => page.id));
  let seq = nextPageSeqFromIds(
    [...existingIds, ...input.pages.map((page) => page.id)],
    sw.page_seq,
  );
  const idMap = new Map<string, string>();
  const finalPages: SwitchPage[] = [];
  for (const [index, page] of input.pages.entries()) {
    let id = page.id;
    if (!id || !existingIds.has(id)) {
      id = `p${seq}`;
      seq += 1;
      if (page.id) idMap.set(page.id, id);
    }
    idMap.set(id, id);
    finalPages.push({
      ...page,
      id,
      sortOrder: index,
      name: normalizePageName(page.name),
    });
  }

  const finalRecipes: RoundRecipe[] = input.recipes.map((recipe) => ({
    ...recipe,
    pageId: idMap.get(recipe.pageId) ?? recipe.pageId,
  }));

  const named = withSceneNames(finalRecipes, input.snapshot);
  const withDim = finalPages.map((page) =>
    withGroupAndDim(page, named, input.snapshot),
  );

  await sql()`delete from recipes where switch_id = ${sw.id} and page_id is not null`;
  await sql()`delete from pages where switch_id = ${sw.id}`;
  for (const page of withDim) {
    await sql()`
      insert into pages (
        switch_id, id, name, sort_order, theme,
        group_rtype, group_rid, grouped_light_rid, dim
      )
      values (
        ${sw.id}, ${page.id}, ${page.name}, ${page.sortOrder}, ${page.theme},
        ${page.group?.rtype ?? null}, ${page.group?.rid ?? null},
        ${page.group?.groupedLightRid ?? null}, ${dimJson(page.dim)}::jsonb
      )
    `;
  }
  for (const recipe of named) {
    await insertRoundRecipe(sw.id, recipe);
  }
  const rows = await sql()`
    update switches
    set page_swipe_axis = ${input.pageSwipeAxis},
        screen_timeout_sec = ${input.screenTimeoutSec},
        page_seq = ${seq},
        rev = rev + 1,
        rev_changed_at = now()
    where id = ${sw.id}
    returning rev, page_swipe_axis, page_seq, product, screen_timeout_sec
  `;
  const updated = rows[0] as {
    rev: number;
    page_swipe_axis: string;
    page_seq: number;
    product: string;
    screen_timeout_sec: number;
  };
  return {
    rev: Number(updated.rev),
    pageSwipeAxis: (updated.page_swipe_axis === "vertical"
      ? "vertical"
      : "horizontal") as PageSwipeAxis,
    screenTimeoutSec: asScreenTimeoutSec(updated.screen_timeout_sec),
    pages: withDim,
    recipes: named,
  };
}

export async function migrateLegacyRoundSwitches() {
  await sql()`
    update switches
    set product = 'round'
    where product is distinct from 'round'
      and (
        channels = '[]'::jsonb
        or (
          jsonb_typeof(channels) = 'array'
          and jsonb_array_length(channels) = 1
          and coalesce(channels->0->>'id', '') = 'c1'
        )
      )
  `;
  const rounds = await sql()`
    select id, user_id, bridgeid, product, page_seq
    from switches
    where product = 'round'
  `;
  for (const row of rounds) {
    const rec = row as Record<string, unknown>;
    const switchId = String(rec.id);
    const userId = String(rec.user_id);
    const bridgeid = String(rec.bridgeid);
    await ensureDefaultRoundPage(switchId);
    await migrateC1RecipesForSwitch(switchId, userId, bridgeid);
    await migratePageGroupsForSwitch(switchId, userId, bridgeid);
  }
}

async function migratePageGroupsForSwitch(
  switchId: string,
  userId: string,
  bridgeid: string,
) {
  const snapshot = await snapshotForSwitch(userId, bridgeid);
  const pages = await listPages(switchId);
  const recipes = await listRoundRecipes(switchId);
  const changed = await persistPageGroupAndDim(
    switchId,
    pages,
    recipes,
    snapshot,
  );
  if (changed) {
    await incrementSwitchRev(switchId);
  }
}

export function isRoundSwitch(row: {
  product: SwitchProduct;
  channels: Channel[];
}): boolean {
  return row.product === "round" || isPlaceholderRoundChannels(row.channels);
}
