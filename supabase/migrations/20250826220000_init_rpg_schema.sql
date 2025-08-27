-- Player stats
create table characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text,
  level int,
  str int default 10,
  dex int default 10,
  intt int default 10,
  wis int default 10,
  con int default 10,
  cha int default 10,
  luck int default 10
);

-- Loot enums
create type gear_slot as enum ('weapon','helm','chest','gloves','pants','boots');
create type gear_rarity as enum ('common','uncommon','rare','epic','legendary');

-- Stored items
create table gear_items (
  id uuid primary key default gen_random_uuid(),
  owner_user uuid references auth.users(id) on delete cascade,
  character_id uuid references characters(id),
  slot gear_slot not null,
  rarity gear_rarity not null,
  base jsonb not null,
  substats jsonb not null,
  score int not null,
  created_at timestamptz default now()
);

-- Optional: track equipped gear
create table gear_equipped (
  id uuid primary key default gen_random_uuid(),
  character_id uuid references characters(id) on delete cascade,
  gear_item_id uuid references gear_items(id) on delete cascade,
  slot gear_slot not null,
  constraint gear_equipped_character_slot_unique unique (character_id, slot),
  constraint gear_equipped_item_unique unique (gear_item_id)
);

-- Enable Row-Level Security
alter table characters enable row level security;
create policy "Users manage their own characters" on characters for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table gear_items enable row level security;
create policy "Users access their own gear" on gear_items for all using (auth.uid() = owner_user) with check (auth.uid() = owner_user);

alter table gear_equipped enable row level security;
create policy "Users manage equipped gear" on gear_equipped for all using (
  auth.uid() = (select user_id from characters where id = character_id)
);

-- Helpful indexes
create index gear_items_owner_idx on gear_items(owner_user);
create index gear_items_character_idx on gear_items(character_id);
create index gear_items_slot_idx on gear_items(slot);
create index gear_items_rarity_idx on gear_items(rarity);
create index gear_equipped_character_idx on gear_equipped(character_id);
create index gear_equipped_slot_idx on gear_equipped(slot);
