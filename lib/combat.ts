// lib/combat.ts
import {
  hp as calcHP, atkSpeed, resistPhysicalMelee, resistMagic, resistMental,
  physicalMeleeAttack, physicalRangedAttack, magicAttack, mentalAttack,
  accuracyPercent, dodgeChance, critChance, damageClamp,
} from "./formulas";

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

// -------------------- motor interno --------------------
function runTurnBasedCombat(initialPlayerHP: number, player: Attrs, enemy: Attrs & { name: string }) {
  let playerHP = Math.max(1, Math.floor(initialPlayerHP));
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
        description: r.desc.replace("YOU", enemy.name).replace("TARGET", "Você"),
        damage: r.damage,
        damage_type: r.kind,
        formula: r.formula,
        target_hp_after: playerHP,
      });
      if (playerHP <= 0) break;
    }
  }

  const winner = playerHP > 0 ? "player" : "enemy";
  return { playerHPFinal: playerHP, enemyHPFinal: enemyHP, winner, log };
}

// -------------------- APIs públicas --------------------

// HP cheio dos dois (como já usávamos)
export async function resolveCombat(player: Attrs, enemy: Attrs & { name: string }) {
  const initial = calcHP(player);
  return runTurnBasedCombat(initial, player, enemy);
}

// NOVO: não regenera HP do player (para coliseu/tier em sequência)
export async function resolveCombatFromHP(
  player: Attrs,
  enemy: Attrs & { name: string },
  playerHPStart: number
) {
  return runTurnBasedCombat(playerHPStart, player, enemy);
}

// -------------------- cálculo do golpe --------------------
function attemptAttack(attacker: Attrs & { name?: string }, defender: Attrs) {
  // errou
  if (Math.random() * 100 > accuracyPercent(attacker, defender)) {
    return {
      damage: 0 as const,
      kind: "physical" as const,
      formula: { base:0, atk:0, def:0, rand:0, crit:false, mult:1 },
      desc: "YOU errou o ataque.",
    };
  }
  // alvo desviou
  if (Math.random() * 100 < dodgeChance(defender)) {
    return {
      damage: 0 as const,
      kind: "physical" as const,
      formula: { base:0, atk:0, def:0, rand:0, crit:false, mult:1 },
      desc: "TARGET desviou do ataque de YOU.",
    };
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

  const raw = (base + rand) * mult - Math.floor(def);
  const dmg = damageClamp(raw);

  return {
    damage: dmg,
    kind,
    formula: { base, atk, def: Math.floor(def), rand, crit, mult },
    desc: `YOU causou ${dmg} de dano em TARGET.`,
  };
}
