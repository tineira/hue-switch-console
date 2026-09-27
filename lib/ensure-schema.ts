import { dropLegacySimpleRecipes, migrateLegacyRoundSwitches } from "@/lib/db";
import { sql } from "@/lib/sql";

const STATEMENTS = [
  `create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
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
  `alter table switches add column if not exists applied_rev integer`,
  `alter table switches add column if not exists served_rev integer`,
  `alter table switches add column if not exists apply_failed boolean not null default false`,
  `alter table switches add column if not exists rev_changed_at timestamptz`,
  `alter table switches add column if not exists editing_until timestamptz`,
  `alter table switches add column if not exists next_poll_at timestamptz`,
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
  `create table if not exists simple_channels (
  switch_id uuid not null references switches (id) on delete cascade,
  channel_id text not null,
  kind text not null check (kind in ('maintained', 'momentary')),
  group_rtype text not null check (group_rtype in ('room', 'zone')),
  group_rid text not null,
  grouped_light_rid text not null,
  target_rtype text not null check (target_rtype in ('light', 'grouped_light')),
  target_rid text not null,
  scenes jsonb not null default '[]'::jsonb,
  double_click jsonb,
  hold jsonb,
  primary key (switch_id, channel_id)
)`,
  `alter table simple_channels add column if not exists double_click jsonb`,
  `create table if not exists firmware_releases (
  id uuid primary key default gen_random_uuid(),
  product text not null check (product in ('round', 'simple')),
  version text not null check (version ~ '^\\d+\\.\\d+\\.\\d+$'),
  commit_sha text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (product, version)
)`,
  `create table if not exists firmware_parts (
  release_id uuid not null references firmware_releases (id) on delete cascade,
  name text not null check (name in ('bootloader.bin', 'partitions.bin', 'boot_app0.bin', 'firmware.bin')),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  size integer not null check (size > 0),
  data bytea not null,
  primary key (release_id, name)
)`,
  `create table if not exists firmware_current (
  product text primary key check (product in ('round', 'simple')),
  release_id uuid not null references firmware_releases (id)
)`,
  `alter table firmware_releases add column if not exists credits jsonb`,
  // Multi-user accounts (docs/specs/finished/multi-user-accounts.md §2.9).
  // users doubles as Better Auth's user table; the rest are its tables.
  `alter table users add column if not exists name text not null default ''`,
  `alter table users add column if not exists email_verified boolean not null default false`,
  `alter table users add column if not exists image text`,
  `alter table users add column if not exists updated_at timestamptz not null default now()`,
  // ADMIN_EMAILS is the only admin source; the old role copy goes (admin-tools §2.2).
  `alter table users drop column if exists role`,
  `alter table users add column if not exists banned boolean not null default false`,
  `alter table users add column if not exists ban_reason text`,
  `alter table users add column if not exists ban_expires timestamptz`,
  `alter table users add column if not exists last_login_at timestamptz`,
  `alter table users add column if not exists limits jsonb not null default '{}'::jsonb`,
  `alter table users add column if not exists register_refused_at timestamptz`,
  `alter table users add column if not exists register_refused_reason text`,
  `create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)`,
  `create index if not exists sessions_user_id_idx on sessions (user_id)`,
  `create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  account_id text not null,
  provider_id text not null,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, account_id)
)`,
  `create index if not exists accounts_user_id_idx on accounts (user_id)`,
  `create table if not exists verifications (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,
  value text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)`,
  `create index if not exists verifications_identifier_idx on verifications (identifier)`,
  `create table if not exists rate_limits (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  count integer not null,
  last_request bigint not null
)`,
  `create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  code_prefix text not null,
  email text,
  created_by uuid references users (id) on delete set null,
  expires_at timestamptz not null,
  used_by uuid references users (id) on delete set null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
)`,
  `create table if not exists invite_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  status text not null default 'pending',
  invite_id uuid references invites (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
)`,
  `create unique index if not exists invite_requests_pending_email_idx
  on invite_requests (lower(email)) where status = 'pending'`,
  `create table if not exists auth_events (
  id bigserial primary key,
  kind text not null check (kind in ('email_sent', 'code_sent', 'code_failed', 'invite_requested')),
  email text,
  ip text,
  created_at timestamptz not null default now()
)`,
  `alter table auth_events drop constraint if exists auth_events_kind_check`,
  `alter table auth_events add constraint auth_events_kind_check check (kind in ('email_sent', 'code_sent', 'code_failed', 'invite_requested', 'waitlist_email_sent', 'email_bounced', 'email_complained'))`,
  `alter table auth_events add column if not exists detail text`,
  `create index if not exists auth_events_email_idx on auth_events (kind, email, created_at)`,
  `create index if not exists auth_events_time_idx on auth_events (kind, created_at)`,
  // Waitlist with a user cap (docs/specs/waitlist.md §2.8).
  `create table if not exists console_settings (
  id boolean primary key default true check (id),
  signup_mode text check (signup_mode in ('invite', 'waitlist')),
  user_cap integer check (user_cap >= 0),
  cap_alert_sent integer,
  joins_total bigint not null default 0,
  updated_at timestamptz not null default now()
)`,
  `alter table invite_requests drop constraint if exists invite_requests_status_check`,
  `alter table invite_requests add constraint invite_requests_status_check check (status in ('pending', 'approved', 'dismissed', 'expired', 'left', 'bounced', 'complained'))`,
  `alter table invite_requests add column if not exists confirmation_sent_at timestamptz`,
  `alter table invite_requests add column if not exists leave_token_hash text`,
  `alter table invite_requests drop column if exists note`,
  `create index if not exists invite_requests_email_idx on invite_requests (lower(email), status)`,
  // Admin tools (docs/specs/finished/admin-tools.md §2.9).
  `create table if not exists admin_events (
  id bigserial primary key,
  admin_email text not null,
  action text not null,
  target_user_id uuid references users(id) on delete set null,
  target text,
  details jsonb,
  created_at timestamptz not null default now()
)`,
  `create index if not exists admin_events_created on admin_events (created_at desc)`,
  `create index if not exists switches_user_seen_idx on switches (user_id, last_seen_at)`,
  // Pre-Better Auth consoles kept the password on users.password_hash. Move any hash that
  // has no credential row yet, then drop the column (docs/specs/finished/multi-user-accounts.md §3).
  `do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = current_schema() and table_name = 'users' and column_name = 'password_hash') then
    insert into accounts (user_id, account_id, provider_id, password)
    select u.id, u.id::text, 'credential', u.password_hash
    from users u
    where u.password_hash is not null
      and not exists (select 1 from accounts a where a.user_id = u.id and a.provider_id = 'credential');
    alter table users drop column password_hash;
  end if;
end $$`,
];

let running: Promise<void> | null = null;

async function applySchema() {
  const db = sql();
  for (const statement of STATEMENTS) {
    await db.query(statement);
  }
  await migrateLegacyRoundSwitches();
  await dropLegacySimpleRecipes();
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
