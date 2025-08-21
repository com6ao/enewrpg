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

  let gP = 0, gE = 0;
  const sP = speedOf(p), sE = speedOf(e);
  const log: CombatLine[] = [];
  const MAX_ACTIONS = 200;

  while (p.hp > 0 && e.hp > 0 && log.length < MAX_ACTIONS) {
    while (gP < 1 && gE < 1) { gP += sP; gE += sE; }
    if (gP >= gE) {
      const ln = doAttack(p, e, "player", "enemy"); ln.source = "player";
      e = { ...e, hp: clamp(e.hp - ln.dmg, 0, e.hpMax) };
      log.push(ln);
      gP -= 1;
    } else {
      const ln = doAttack(e, p, "enemy", "player"); ln.source = "enemy";
      p = { ...p, hp: clamp(p.hp - ln.dmg, 0, p.hpMax) };
      log.push(ln);
      gE -= 1;
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
