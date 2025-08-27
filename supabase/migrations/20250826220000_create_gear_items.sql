-- Create enum types for gear slot and rarity
create type gear_slot as enum ('helmet','weapon','ring','shield','chest','pants','boots');
create type gear_rarity as enum ('common','uncommon','rare','epic','legendary');

-- Table storing every gear item owned by a character
create table gear_items (
  id uuid primary key default gen_random_uuid(),
  character_id uuid references characters(id) on delete cascade,
  name text not null,
  slot gear_slot not null,
  rarity gear_rarity not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helpful indexes
create index gear_items_slot_idx on gear_items(slot);
create index gear_items_rarity_idx on gear_items(rarity);
