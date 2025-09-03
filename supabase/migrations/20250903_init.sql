-- 20250903_init.sql
-- Baseline do schema público do enewrpg

-- Extensões necessárias
create extension if not exists pgcrypto;

-- ==== ENUMS ====
-- Ajuste os valores se seu projeto usar outro conjunto
do $$
begin
  if not exists (select 1 from pg_type where typname = 'gear_rarity') then
    create type public.gear_rarity as enum ('common','uncommon','rare','epic','legendary','mythic');
  end if;
  if not exists (select 1 from pg_type where typname = 'slot') then
    create type public.slot as enum ('weapon','helmet','armor','boots','ring','amulet','belt','gloves','cape','artifact');
  end if;
  if not exists (select 1 from pg_type where typname = 'energy') then
    create type public.energy as enum ('full','high','normal','low','empty');
  end if;
end$$;

-- ==== TABELAS ====

-- arena_sessions
create table if not exists public.arena_sessions (
  id uuid primary key,
  srv jsonb not null,
  status text not null,
  winner text,
  cursor integer not null default 0
);

-- battles
create table if not exists public.battles (
  gauges jsonb not null default '{}'::jsonb,
  player_name text default 'Você'::text,
  player_level integer default 1,
  enemy_level integer default 1,
  player_attrs jsonb,
  enemy_attrs jsonb,
  user_id uuid not null,
  character_id uuid not null,
  area text not null,
  enemy_id uuid not null,
  enemy_name text not null,
  player_hp integer not null,
  player_hp_max integer not null,
  enemy_hp integer not null,
  enemy_hp_max integer not null,
  winner text,
  id uuid primary key default gen_random_uuid(),
  cursor integer not null default 0,
  log jsonb not null default '[]'::jsonb,
  status text not null default 'active'::text,
  created_at timestamptz not null default now()
);

-- characters
create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  level integer not null default 1,
  user_id uuid not null,
  name text not null unique,
  surname text not null,
  universe text not null,
  energy public.energy not null,
  xp integer not null default 0,
  points_available integer not null default 20,
  str integer not null default 0,
  dex integer not null default 0,
  intt integer not null default 0,
  wis integer not null default 0,
  cha integer not null default 0,
  con integer not null default 0,
  created_at timestamptz default now(),
  luck integer not null default 10,
  gold integer default 0,
  constraint characters_user_id_fkey foreign key (user_id) references auth.users(id)
);

-- enemies
create table if not exists public.enemies (
  name text not null,
  category text not null,
  level integer not null,
  hp integer not null,
  str integer not null,
  dex integer not null,
  intt integer not null,
  wis integer not null,
  cha integer not null,
  con integer not null,
  luck integer not null,
  reward_xp integer not null,
  reward_gold integer not null,
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now()
);

-- gear_items
create table if not exists public.gear_items (
  owner_user uuid not null,
  character_id uuid,
  slot public.slot not null,
  id uuid primary key default gen_random_uuid(),
  rarity public.gear_rarity not null default 'common',
  base jsonb not null default '{}'::jsonb,
  substats jsonb not null default '[]'::jsonb,
  score integer not null default 0,
  created_at timestamptz not null default now(),
  constraint gear_items_owner_user_fkey foreign key (owner_user) references auth.users(id),
  constraint gear_items_character_id_fkey foreign key (character_id) references public.characters(id)
);

-- gear_equipped
create table if not exists public.gear_equipped (
  character_id uuid not null,
  gear_item_id uuid not null unique,
  slot public.slot not null,
  id uuid primary key default gen_random_uuid(),
  constraint gear_equipped_gear_item_id_fkey foreign key (gear_item_id) references public.gear_items(id),
  constraint gear_equipped_character_id_fkey foreign key (character_id) references public.characters(id)
);

-- notes
create table if not exists public.notes (
  id bigserial primary key,
  title text not null
);

-- profiles
create table if not exists public.profiles (
  id uuid primary key,
  active_character_id uuid,
  constraint profiles_id_fkey foreign key (id) references auth.users(id),
  constraint profiles_active_character_id_fkey foreign key (active_character_id) references public.characters(id)
);
