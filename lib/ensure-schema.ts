import { migrateLegacyRoundSwitches } from "@/lib/db";
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
  product text not null default 'simple' check (product in ('simple', 'round')),
  page_swipe_axis text not null default 'horizontal' check (page_swipe_axis in ('horizontal', 'vertical')),
  page_seq integer not null default 1,
  screen_timeout_sec integer not null default 30
    check (screen_timeout_sec = 0 or (screen_timeout_sec >= 10 and screen_timeout_sec <= 600)),
  unique (user_id, mac)
)`,
  `create index if not exists switches_user_bridge_idx
  on switches (user_id, bridgeid)`,
  `alter table switches add column if not exists product text not null default 'simple'`,
  `alter table switches add column if not exists page_swipe_axis text not null default 'horizontal'`,
  `alter table switches add column if not exists page_seq integer not null default 1`,
  `alter table switches add column if not exists screen_timeout_sec integer not null default 30`,
  `alter table switches drop constraint if exists switches_product_check`,
  `alter table switches add constraint switches_product_check check (product in ('simple', 'round'))`,
  `alter table switches drop constraint if exists switches_page_swipe_axis_check`,
  `alter table switches add constraint switches_page_swipe_axis_check check (page_swipe_axis in ('horizontal', 'vertical'))`,
  `alter table switches drop constraint if exists switches_screen_timeout_sec_check`,
  `alter table switches add constraint switches_screen_timeout_sec_check check (screen_timeout_sec = 0 or (screen_timeout_sec >= 10 and screen_timeout_sec <= 600))`,
  `create table if not exists pages (
  switch_id uuid not null references switches (id) on delete cascade,
  id text not null,
  name text not null check (char_length(name) between 1 and 12),
  sort_order integer not null,
  theme text not null default 'ember',
  group_rtype text,
  group_rid text,
  grouped_light_rid text,
  dim jsonb,
  dim_target_rtype text,
  dim_target_rid text,
  primary key (switch_id, id)
)`,
  `alter table pages add column if not exists group_rtype text`,
  `alter table pages add column if not exists group_rid text`,
  `alter table pages add column if not exists grouped_light_rid text`,
  `alter table pages add column if not exists dim jsonb`,
  `create index if not exists pages_switch_sort_idx
  on pages (switch_id, sort_order)`,
  `create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  switch_id uuid not null references switches (id) on delete cascade,
  channel_id text,
  page_id text,
  event text not null check (event in ('on', 'off', 'double_click', 'short')),
  action text not null check (action in ('on', 'off', 'recall_scene', 'toggle')),
  target_rtype text not null check (target_rtype in ('light', 'grouped_light', 'scene')),
  target_rid text not null,
  targets jsonb not null default '[]'::jsonb
)`,
  `alter table recipes add column if not exists page_id text`,
  `alter table recipes add column if not exists targets jsonb not null default '[]'::jsonb`,
  `alter table recipes alter column channel_id drop not null`,
  `alter table recipes drop constraint if exists recipes_switch_id_channel_id_event_key`,
  `create unique index if not exists recipes_simple_uniq
  on recipes (switch_id, channel_id, event)
  where page_id is null and channel_id is not null`,
  `create unique index if not exists recipes_round_uniq
  on recipes (switch_id, page_id, event)
  where page_id is not null`,
  `create index if not exists recipes_switch_id_idx on recipes (switch_id)`,
];

let running: Promise<void> | null = null;

async function applySchema() {
  const db = sql();
  for (const statement of STATEMENTS) {
    await db.query(statement);
  }
  await migrateLegacyRoundSwitches();
}

export async function ensureSchema() {
  if (!running) {
    running = applySchema().catch((err) => {
      running = null;
      throw err;
    });
  }
  return running;
}
