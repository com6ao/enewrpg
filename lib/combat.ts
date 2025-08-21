// lib/combat.ts
export type Attrs = {
  level: number;
  str: number;
  dex: number;
  intt: number; // INT
  wis: number;
  cha: number;
  con: number;
  luck: number;
};

export type CombatLine = {
  text: string;
  dmg: number;
  from: "player" | "enemy";
  to: "player" | "enemy";
  kind: "hit" | "crit" | "miss";
  source?: "player" | "enemy";
};

type UnitState = {
  name: string;
  level: number;
  hp: number;
  hpMax: number;
  attrs: Attrs;
};

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const num = (v: any, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

function hpFrom(level: number, con: number) {
  return Math.max(1, Math.floor(30 + level * 2 + con * 3));
}

// Velocidade = DEX + WIS
function speedOf(u: UnitState) {
  const { dex = 0, wis = 0 } = u.attrs;
  return 0.4 + dex * 0.05 + wis * 0.03;
}

function rng(luck: number) {
  const base = Math.random();
  const luckBoost = clamp(luck, 0, 100) / 100;
  return { base, crit: base > 0.9 - luckBoost * 0.2, miss: base < 0.05 * (1 - luckBoost * 0.6) };
}

// Dano = STR + INT
function doAttack(atk: UnitState, def: UnitState, from: "player" | "enemy", to: "player" | "enemy"): CombatLine {
  const { str = 0, intt = 0, luck = 0 } = atk.attrs;
  const roll = rng(luck);
  if (roll.miss) return { text: `${atk.name} errou o ataque!`, dmg: 0, from, to, kind: "miss" };

  const baseDmg = Math.max(1, Math.floor((str + intt) * 1.2 + (atk.level ?? 1) * 0.5));
  const spread = 0.8 + roll.base * 0.4;
  let dmg = Math.floor(baseDmg * spread);
  let kind: CombatLine["kind"] = "hit";
  if (roll.crit) { dmg = Math.floor(dmg * 1.6); kind = "crit"; }
  return { text: `Dano: ${dmg} (${kind})`, dmg, from, to, kind };
}

function toUnit(name: string, a: Attrs): UnitState {
  const level = num(a.level, 1);
  const hpMax = hpFrom(level, num(a.con, 5));
  return { name, level, hp: hpMax, hpMax, attrs: { ...a, level } };
}

export async function resolveCombat(player: Attrs, enemy: Attrs & { name?: string }) {
  let p = toUnit("Você", player);
  let e = toUnit(enemy.name ?? "Inimigo", enemy);

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
        // aqui o atacante é o inimigo: YOU -> nome do inimigo, TARGET -> Você
        description: r.desc.replace("YOU", enemy.name).replace("TARGET", "Você"),
        damage: r.damage,
        damage_type: r.kind,
        formula: r.formula,
        target_hp_after: playerHP,
      });
      if (playerHP <= 0) break;
    }
  }

  const finished = p.hp <= 0 || e.hp <= 0;
  const winner = finished ? (p.hp > 0 ? "player" : e.hp > 0 ? "enemy" : "draw") : null;

  return {
    winner,
    playerMaxHp: p.hpMax,
    enemyMaxHp: e.hpMax,
    playerEndHp: p.hp,
    enemyEndHp: e.hp,
    actions: log.length,
    log,
  };
}
