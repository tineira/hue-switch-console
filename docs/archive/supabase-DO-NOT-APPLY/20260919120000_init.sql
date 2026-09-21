-- Postgres is the source of truth for API keys, topology, switches, and recipes.

create table public.device_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  key_prefix text not null,
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_used_at timestamptz
);

create index device_api_keys_user_id_idx
  on public.device_api_keys (user_id)
  where revoked_at is null;

create table public.bridges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  bridgeid text not null,
  bridge_ip text,
  snapshot jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, bridgeid)
);

create table public.switches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mac text not null check (mac ~ '^[0-9a-f]{12}$'),
  label text,
  firmware text,
  bridgeid text not null,
  bridge_ip text,
  channels jsonb not null default '[]'::jsonb,
  api_key_id uuid references public.device_api_keys (id) on delete set null,
  rev integer not null default 0,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, mac)
);

create index switches_user_bridge_idx
  on public.switches (user_id, bridgeid);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  switch_id uuid not null references public.switches (id) on delete cascade,
  channel_id text not null,
  event text not null check (event in ('on', 'off', 'double_click', 'short')),
  action text not null check (action in ('on', 'off', 'recall_scene', 'toggle')),
  target_rtype text not null check (target_rtype in ('light', 'grouped_light', 'scene')),
  target_rid text not null,
  unique (switch_id, channel_id, event)
);

create index recipes_switch_id_idx on public.recipes (switch_id);

create or replace function public.replace_switch_recipes(p_switch_id uuid, p_recipes jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_rev integer;
begin
  delete from public.recipes where switch_id = p_switch_id;

  insert into public.recipes (switch_id, channel_id, event, action, target_rtype, target_rid)
  select
    p_switch_id,
    rec->>'channelId',
    rec->>'event',
    rec->>'action',
    rec->'target'->>'rtype',
    rec->'target'->>'rid'
  from jsonb_array_elements(coalesce(p_recipes, '[]'::jsonb)) as rec;

  update public.switches
    set rev = rev + 1
    where id = p_switch_id
    returning rev into new_rev;

  if new_rev is null then
    raise exception 'switch not found';
  end if;

  return new_rev;
end;
$$;

revoke all on function public.replace_switch_recipes(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_switch_recipes(uuid, jsonb) to service_role;

alter table public.device_api_keys enable row level security;
alter table public.bridges enable row level security;
alter table public.switches enable row level security;
alter table public.recipes enable row level security;

create policy device_api_keys_own on public.device_api_keys
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy bridges_own on public.bridges
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy switches_own on public.switches
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy recipes_own on public.recipes
  for all to authenticated
  using (
    exists (
      select 1 from public.switches s
      where s.id = recipes.switch_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.switches s
      where s.id = recipes.switch_id and s.user_id = auth.uid()
    )
  );

revoke all on table public.device_api_keys from anon;
revoke all on table public.bridges from anon;
revoke all on table public.switches from anon;
revoke all on table public.recipes from anon;
