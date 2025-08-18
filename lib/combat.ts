// lib/combat.ts

export type Attrs = {
  str: number;
  dex: number;
  intt: number;
  wis: number;
  cha: number;
  con: number;
  luck: number;
  level: number;
};

export type BattleLogEntry = {
  actor: "player" | "enemy";
  type: "action_complete" | "action_bonus";
  description: string;
  target_hp_after: number;
};

// --- SUBATRIBUTOS -----------------------------------------------------------

export function calcHP(c: Attrs) {
  return 30 + c.level * 5 + (c.con * 1);
}

export function calcMP(c: Attrs, main: number) {
  return 30 + c.level * 5 + main + (c.con * 0.5);
}

export function atkSpeed(c: Attrs) {
  return c.dex;
}

export function castSpeed(c: Attrs) {
  return c.wis;
}

export function resistPhysicalMelee(c: Attrs) {
  return c.str + (c.con * 0.5);
}

export function resistPhysicalRanged(c: Attrs) {
  return c.dex + (c.con * 0.5);
}

export function resistMagic(c: Attrs) {
  return c.intt + (c.con * 0.5);
}

export function resistMental(c: Attrs) {
  return c.wis + (c.con * 0.5);
}

export function dodgeChance(c: Attrs) {
  return c.luck + (c.dex * 0.5);
}

export function critChance(c: Attrs) {
  return c.luck;
}

export function critDefense(c: Attrs) {
  return c.cha;
}

export function trueDamageChance(c: Attrs) {
  return c.wis;
}

export function damageReductionChance(c: Attrs) {
  return c.cha;
}

export function physicalMeleeAttack(c: Attrs) {
  return c.str + (c.dex * 0.5);
}

export function physicalRangedAttack(c: Attrs) {
  return c.dex + (c.str * 0.5);
}

export function magicAttack(c: Attrs) {
  return c.intt;
}

export function mentalAttack(c: Attrs) {
  return c.wis;
}

// Precisão como porcentagem, comparando level e maior atributo
export function accuracyPercent(attacker: Attrs, defender: Attrs) {
  const mainAtk = Math.max(attacker.str, attacker.dex, attacker.intt);
  const mainDef = Math.max(defender.str, defender.dex, defender.intt);

  let base = 100;
  const levelDiff = attacker.level - defender.level;
  base += levelDiff * 5;

  const diffAttr = mainAtk - mainDef;
  base += diffAttr * 2;

  return Math.min(100, Math.max(0, base));
}

// --- LOOP DE COMBATE --------------------------------------------------------

export async function resolveCombat(
  player: Attrs,
  enemy: Attrs & { name: string }
) {
  let playerHP = calcHP(player);
  let enemyHP = calcHP(enemy);

  let barPlayer = 0;
  let barEnemy = 0;
  const speedPlayer = atkSpeed(player);
  const speedEnemy = atkSpeed(enemy);

  const log: BattleLogEntry[] = [];

  while (playerHP > 0 && enemyHP > 0) {
    barPlayer += speedPlayer;
    barEnemy += speedEnemy;

    if (barPlayer >= 100) {
      barPlayer -= 100;
      const dmg = attemptAttack(player, enemy);
      enemyHP = Math.max(0, enemyHP - dmg.appliedDamage);

      log.push({
        actor: "player",
        type: "action_complete",
        description: dmg.logMsg.replace("TARGET", enemy.name).replace("YOU", "Você"),
        target_hp_after: enemyHP
      });
      if (enemyHP <= 0) break;
    }

    if (barEnemy >= 100) {
      barEnemy -= 100;
      const dmg = attemptAttack(enemy, player);
      playerHP = Math.max(0, playerHP - dmg.appliedDamage);

      log.push({
        actor: "enemy",
        type: "action_complete",
        description: dmg.logMsg.replace("YOU", "Você"),
        target_hp_after: playerHP
      });
      if (playerHP <= 0) break;
    }
  }

  return {
    result: playerHP > 0 ? "win" : "lose",
    log
  };
}

// ---------------------------------------------------------------------------
// calcula um ataque
function attemptAttack(attacker: Attrs & { name?: string }, defender: Attrs) {
  const acc = accuracyPercent(attacker, defender);
  if (Math.random() * 100 > acc) {
    return {
      appliedDamage: 0,
      logMsg: `YOU errou o ataque.`
    };
  }

  if (Math.random() * 100 < dodgeChance(defender)) {
    return {
      appliedDamage: 0,
      logMsg: `TARGET desviou do ataque de YOU.`
    };
  }

  let baseDmg = 0;
  if (attacker.intt >= attacker.str && attacker.intt >= attacker.dex && attacker.intt >= attacker.wis) {
    baseDmg = magicAttack(attacker);
  } else if (attacker.wis >= attacker.str && attacker.wis >= attacker.dex && attacker.wis >= attacker.intt) {
    baseDmg = mentalAttack(attacker);
  } else {
    const melee = physicalMeleeAttack(attacker);
    const ranged = physicalRangedAttack(attacker);
    baseDmg = Math.max(melee, ranged);
  }

  let finalDmg = baseDmg;
  if (Math.random() * 100 < critChance(attacker)) {
    finalDmg *= 1.5;
  }

  const res =
    baseDmg === magicAttack(attacker)
      ? resistMagic(defender)
      : baseDmg === mentalAttack(attacker)
        ? resistMental(defender)
        : resistPhysicalMelee(defender); // (simplificado p/ ranged)

  finalDmg = Math.max(1, finalDmg - res);

  return {
    appliedDamage: Math.floor(finalDmg),
    logMsg: `YOU causou ${Math.floor(finalDmg)} de dano em TARGET.`
  };
}
