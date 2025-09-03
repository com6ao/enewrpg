-- enewrpg: fix schema for characters, profiles, gear view
-- Safe to run multiple times.

begin;

-- 1) characters: campos faltantes
alter table if exists public.characters
  add column if not exists surname text,
  add column if not exists universe text,
  add column if not exists energy   text;

-- 1.1) Garantir RLS básica (ignora se já existir)
alter table if exists public.characters enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='characters' and policyname='own characters'
  ) then
    create policy "own characters" on public.characters
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end$$;

-- 2) profiles: criar se não existir
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  active_character_id uuid references public.characters(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_profiles_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_profiles_updated_at();

alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='profiles' and policyname='own profile all'
  ) then
    create policy "own profile all" on public.profiles
      for all
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end$$;

-- RPC opcional: garantir que o perfil exista
create or replace function public.ensure_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (auth.uid())
  on conflict (id) do nothing;
end$$;

revoke all on function public.ensure_profile() from public;
grant execute on function public.ensure_profile() to authenticated;

-- 3) Índices úteis (idempotentes)
do $$
begin
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='idx_gear_items_owner') then
    create index idx_gear_items_owner on public.gear_items(owner_user);
  end if;
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='idx_gear_items_char') then
    create index idx_gear_items_char on public.gear_items(character_id);
  end if;
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='idx_gear_items_slot') then
    create index idx_gear_items_slot on public.gear_items(slot);
  end if;
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='idx_gear_items_rarity') then
    create index idx_gear_items_rarity on public.gear_items(rarity);
  end if;
end$$;

-- 4) View para alinhar shape do JSON de gear (key→stat)
create or replace view public.gear_items_view as
select
  gi.id,
  gi.owner_user,
  gi.character_id,
  gi.slot,
  gi.rarity,
  jsonb_build_object('stat', gi.base->>'key', 'value', coalesce((gi.base->>'value')::int, 0)) as base,
  (
    select jsonb_agg(
      jsonb_build_object('stat', s->>'key', 'value', coalesce((s->>'value')::int, 0))
    )
    from jsonb_array_elements(coalesce(gi.substats, '[]'::jsonb)) as s
  ) as substats,
  gi.score,
  gi.created_at
from public.gear_items gi;

comment on view public.gear_items_view is
  'Mapeia {key,value}→{stat,value} para compatibilidade com o front.';

commit;
