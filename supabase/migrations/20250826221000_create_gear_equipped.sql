-- Track which items are equipped in a given slot
create table gear_equipped (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references characters(id) on delete cascade,
  gear_item_id uuid not null references gear_items(id) on delete cascade,
  slot gear_slot not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gear_equipped_character_slot_unique unique (character_id, slot),
  constraint gear_equipped_item_unique unique (gear_item_id)
);

-- Indexes to speed lookups
create index gear_equipped_character_idx on gear_equipped(character_id);
create index gear_equipped_slot_idx on gear_equipped(slot);
