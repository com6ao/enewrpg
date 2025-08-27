// lib/loot.ts
export type LootItem = { name: string };

const POOL = [
  "Espada Enferrujada",
  "Arco Simples",
  "Varinha Queimada",
  "Daga Cega",
];

export function rollLoot(): LootItem[] {
  const count = Math.floor(Math.random() * 3); // 0-2 items
  const drops: LootItem[] = [];
  for (let i = 0; i < count; i++) {
    const name = POOL[Math.floor(Math.random() * POOL.length)];
    drops.push({ name });
  }
  return drops;
}
