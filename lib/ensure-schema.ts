import { sql } from "@/lib/sql";

const STATEMENTS = [
  `create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
)`,
  `create table if not exists device_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  key_prefix text not null,
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_used_at timestamptz
)`,
  `create index if not exists device_api_keys_user_id_idx
  on device_api_keys (user_id)
  where revoked_at is null`,
  `create table if not exists bridges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  bridgeid text not null,
  bridge_ip text,
  snapshot jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, bridgeid)
)`,
  `create table if not exists switches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  mac text not null check (mac ~ '^[0-9a-f]{12}$'),
  label text,
  firmware text,
  bridgeid text not null,
  bridge_ip text,
  channels jsonb not null default '[]'::jsonb,
  api_key_id uuid references device_api_keys (id) on delete set null,
  rev integer not null default 0,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, mac)
)`,
  `create index if not exists switches_user_bridge_idx
  on switches (user_id, bridgeid)`,
  `create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  switch_id uuid not null references switches (id) on delete cascade,
  channel_id text not null,
  event text not null check (event in ('on', 'off', 'double_click', 'short')),
  action text not null check (action in ('on', 'off', 'recall_scene', 'toggle')),
  target_rtype text not null check (target_rtype in ('light', 'grouped_light', 'scene')),
  target_rid text not null,
  unique (switch_id, channel_id, event)
)`,
  `create index if not exists recipes_switch_id_idx on recipes (switch_id)`,
];

export async function ensureSchema() {
  const db = sql();
  for (const statement of STATEMENTS) {
    await db.query(statement);
  }
}
