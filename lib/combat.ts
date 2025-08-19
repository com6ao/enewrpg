// lib/combat.ts

export type Attrs = {
  str: number; dex: number; intt: number; wis: number; cha: number; con: number; luck: number; level: number;
};

export type BattleLogEntry = {
  actor: "player" | "enemy";
  type: "action_complete";
  description: string;
  damage: number;
  damage_type: "physical" | "magical" | "mental";
  formula: { base: number; atk: number; def: number; rand: number; crit: boolean; mult: number };
  target_hp_after: number;
};

// ---- Subatributos de combate (compatíveis com suas fórmulas) ----
export function calcHP(c: Attrs) { return 30 + c.level * 5 + c.con * 1; }
export function atkSpeed(c: Attrs) { return c.dex; }
export function resistPhysicalMelee(c: Attrs) { return c.str + c.con * 0.5; }
export function resistPhysicalRanged(c: Attrs) { return c.dex + c.con * 0.5; }
export function resistMagic(c: Attrs) { return c.intt + c.con * 0.5; }
export function resistMental(c: Attrs) { return c.wis + c.con * 0.5; }
export function dodgeChance(c: Attrs) { return c.luck + c.dex * 0.5; }
export function critChance(c: Attrs)  { return c.luck; }
export function physicalMeleeAttack(c: Attrs) { return c.str + c.dex * 0.5; }
export function physicalRangedAttack(c: Attrs) { return c.dex + c.str * 0.5; }
export function magicAttack(c: Attrs) { return c.intt; }
export function mentalAttack(c: Attrs) { return c.wis; }

export function accuracyPercent(attacker: Attrs, defender: Attrs) {
  const mainAtk = Math.max(attacker.str, attacker.dex, attacker.intt);
  const mainDef = Math.max(defender.str, defender.dex, defender.intt);
  let base = 100 + (attacker.level - defender.level) * 5 + (mainAtk - mainDef) * 2;
  return Math.min(100, Math.max(0, base));
}

// ---- Loop padrão (HP cheio do jogador) ----
export async function resolveCombat(player: Attrs, enemy: Attrs & { name: string }) {
  return resolveCombatFromHP(player, enemy, /*playerHPStart*/ calcHP(player));
}

// ---- (NOVO) Loop aceitando HP inicial do jogador (torneio/coliseu) ----
export async function resolveCombatFromHP(
  player: Attrs,
  enemy: Attrs & { name: string },
  playerHPStart: number
) {
  let playerHP = Math.max(1, Math.floor(playerHPStart)); // <- não regenera
  let enemyHP  = calcHP(enemy);

  let barP = 0, barE = 0;
  const spP = atkSpeed(player), spE = atkSpeed(enemy);

  const log: BattleLogEntry[] = [];

  while (playerHP > 0 && enemyHP > 0) {
    barP += spP; barE += spE;

    if (barP >= 100) {
      barP -= 100;
      const r = attemptAttack(player, enemy);
      enemyHP = Math.max(0, enemyHP - r.damage);
      log.push({
        actor: "player",
        type: "action_complete",
        description: r.desc.replace("TARGET", enemy.name).replace("YOU", "Você"),
        damage: r.damage,
        damage_type: r.kind,
        formula: r.formula,
        target_hp_after: enemyHP,
      });
      if (enemyHP <= 0) break;
    }

    if (barE >= 100) {
      barE -= 100;
      const r = attemptAttack(enemy, player);
      playerHP = Math.max(0, playerHP - r.damage);
      log.push({
        actor: "enemy",
        type: "action_complete",
        // atacante é o inimigo: YOU -> nome do inimigo, TARGET -> Você
        description: r.desc.replace("YOU", enemy.name).replace("TARGET", "Você"),
        damage: r.damage,
        damage_type: r.kind,
        formula: r.formula,
        target_hp_after: playerHP,
      });
      if (playerHP <= 0) break;
    }
  }

  return {
    playerHPFinal: playerHP,
    enemyHPFinal: enemyHP,
    winner: playerHP > 0 ? "player" : "enemy",
    log,
  };
}

// ---- Core do ataque ----
function attemptAttack(attacker: Attrs & { name?: string }, defender: Attrs) {
  if (Math.random() * 100 > accuracyPercent(attacker, defender)) {
    return { damage: 0, kind: "physical" as const,
      formula: { base:0, atk:0, def:0, rand:0, crit:false, mult:1 },
      desc: "YOU errou o ataque." };
  }
  if (Math.random() * 100 < dodgeChance(defender)) {
    return { damage: 0, kind: "physical" as const,
      formula: { base:0, atk:0, def:0, rand:0, crit:false, mult:1 },
      desc: "TARGET desviou do ataque de YOU." };
  }

  const atkPhysical = Math.max(physicalMeleeAttack(attacker), physicalRangedAttack(attacker));
  const atkMagical  = magicAttack(attacker);
  const atkMental   = mentalAttack(attacker);

  let kind: "physical" | "magical" | "mental" = "physical";
  let atk = atkPhysical;
  let def = resistPhysicalMelee(defender);

  if (atkMagical >= atkPhysical && atkMagical >= atkMental) {
    kind = "magical"; atk = atkMagical; def = resistMagic(defender);
  } else if (atkMental >= atkPhysical && atkMental >= atkMagical) {
    kind = "mental";  atk = atkMental;  def = resistMental(defender);
  }

  const base = atk;
  const rand = Math.floor(Math.random() * 4); // 0..3
  const crit = Math.random() * 100 < critChance(attacker);
  const mult = crit ? 1.5 : 1;

  let dmg = Math.max(1, Math.floor((base + rand) * mult) - Math.floor(def));
  const desc = `YOU causou ${dmg} de dano em TARGET.`;

  return { damage: dmg, kind, formula: { base, atk, def: Math.floor(def), rand, crit, mult }, desc };
}
