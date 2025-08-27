export type GearSlot = 'weapon'|'helm'|'chest'|'gloves'|'pants'|'boots';
export type StatKey = 'atk'|'def'|'hp'|'spd'|'crit';

export type GearStat = { key: StatKey; value: number };

export const RARITY = {
  common: { weight: 60, substats: 0 },
  uncommon: { weight: 25, substats: 1 },
  rare: { weight: 10, substats: 2 },
  epic: { weight: 4, substats: 3 },
  legendary: { weight: 1, substats: 4 },
} as const;

export type Rarity = keyof typeof RARITY;

export type GearItem = {
  slot: GearSlot;
  rarity: Rarity;
  base: GearStat;
  substats: GearStat[];
  score: number;
};
