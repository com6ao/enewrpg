export interface GearItem {
  id: string;
  slot: string;
  rarity: string;
  base: { stat: string; value: number } | null;
  substats: { stat: string; value: number }[] | null;
  character_id: string | null;
}
