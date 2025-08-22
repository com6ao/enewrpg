/* ===== Atributos + fórmulas (iguais às que você forneceu) ===== */
export type Attr = {
  str: number;
  dex: number;
  intt: number;
  wis: number;
  cha: number;
  con: number;
  luck: number;
};
export type LevelPack = { level: number };

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const hp = (a: Attr, l: LevelPack) => 30 + (l.level - 1) * 5 + a.con * 1;
export const mpMain = (a: Attr, l: LevelPack, main: "str" | "dex" | "intt") =>
  30 + (l.level - 1) * 5 + a[main] + Math.floor(a.con * 0.5);

// ⚔️ dano base
export const meleeAttack = (a: Attr) => Math.floor(a.str * 1.8);
export const rangedAttack = (a: Attr) => a.dex + Math.floor(a.str * 0.5);
export const magicAttack = (a: Attr) => Math.floor(a.intt * 1.8);
export const mentalAttack = (a: Attr) => a.wis;

// 🛡️ resistências
export const resistPhysicalMelee = (a: Attr) => a.str + Math.floor(a.dex * 0.5) + a.con;
export const resistPhysicalRanged = (a: Attr) => a.dex + Math.floor(a.str * 0.5) + a.con;
export const resistMagic = (a: Attr) => a.intt + a.con;
export const resistMental = (a: Attr) => a.wis + a.con;
export const resistCrit = (a: Attr) => a.cha;

// ⏩ velocidades
export const attackSpeed = (a: Attr) => a.dex + a.wis;
export const castSpeed = (a: Attr) => a.wis;

// 🎯 crítico / reduções
export const critChance = (a: Attr) => clamp(a.luck * 2, 0, 60);
export const critMultiplier = (a: Attr) => 150 + Math.floor(a.cha * 1.5);
export const trueDamageChance = (a: Attr) => clamp(a.wis * 2, 0, 50);
export const damageReductionChance = (a: Attr) => clamp(a.cha * 2, 0, 60);
export const damageReductionPercent = 80;

// 🌀 esquiva
export function dodgeChance(a: Attr) {
  return clamp(Math.floor(a.dex * 1.5), 0, 95);
}
export function accuracyPercent(atkLv: number, defLv: number, atkMax: number, defMax: number) {
  let acc = 100;
  if (defLv > atkLv) acc -= (defLv - atkLv) * 5;
  if (defMax > atkMax) acc -= (defMax - atkMax) * 2;
  return clamp(acc, 5, 100);
}

/* ===== Estruturas e motor ===== */
export type Unit = {
  id: "player" | "enemy";
  name: string;
  level: number;
  attrs: Attr;
  hp: number;
  hpMax: number;
  mp: number;
  mpMax: number;
  atb: number; // 0..100
  usedFull?: boolean;
  usedBonus?: boolean;
  buffs: {
    accBonus?: number;
    dmgBonus?: number;
    enemyResDown?: number;
    turns?: number;
  };
  nextIcon?: string;
};

export type Calc = { text: string; side: "player" | "enemy" };
export type Log = { text: string; side: "neutral" | "player" | "enemy" };
export type ServerState = { player: Unit; enemy: Unit; log: Log[]; calc: Calc[] };

type SkillId = "golpe_poderoso" | "explosao_arcana" | "tiro_preciso";
type BuffId  = "foco" | "fortalecer" | "enfraquecer";

export type ClientCmd =
  | { kind: "basic" }
  | { kind: "skill"; id?: SkillId }
  | { kind: "buff";  id?: BuffId };

export type PublicSnapshot = {
  player: { id: "player"; name: string; level: number; hp: number; hpMax: number; mp: number; mpMax: number; atb: number; nextIcon?: string };
  enemy: { id: "enemy"; name: string; level: number; hp: number; hpMax: number; mp: number; mpMax: number; atb: number; nextIcon?: string };
  log: Log[];
  calc: Calc[];
  srv: ServerState;
};

function copyPub(u: Unit) {
  return { id: u.id, name: u.name, level: u.level, hp: u.hp, hpMax: u.hpMax, mp: u.mp, mpMax: u.mpMax, atb: u.atb, nextIcon: u.nextIcon };
}

function rnd(n: number) { return Math.floor(Math.random() * n); }
function roll(pct: number) { return Math.random() * 100 < pct; }

function applyBuffDecay(u: Unit) {
  if (u.buffs.turns && u.buffs.turns > 0) {
    u.buffs.turns!--;
    if (u.buffs.turns <= 0) u.buffs = {};
  }
}

/* ===== Criação ===== */
function defaultAttrs(): Attr {
  return { str: 10, dex: 10, intt: 10, wis: 10, cha: 10, con: 10, luck: 10 };
}
function buildUnit(id: "player" | "enemy", name: string, level: number, attrs?: Partial<Attr>): Unit {
  const a: Attr = { ...defaultAttrs(), ...attrs };
  return {
    id, name, level, attrs: a,
    hp: hp(a, { level }), hpMax: hp(a, { level }),
    mp: mpMain(a, { level }, a.intt >= a.str && a.intt >= a.dex ? "intt" : a.str >= a.dex ? "str" : "dex"),
    mpMax: mpMain(a, { level }, a.intt >= a.str && a.intt >= a.dex ? "intt" : a.str >= a.dex ? "str" : "dex"),
    atb: 0, buffs: {},
  };
}

/* ===== Dano base/defesa por tipo ===== */
type DmgType = "melee" | "magic" | "ranged" | "mental";
function bestBasic(att: Unit): { base: number; dtype: DmgType; icon: string } {
  const m = meleeAttack(att.attrs);
  const mg = magicAttack(att.attrs);
  const rg = rangedAttack(att.attrs);
  const mt = mentalAttack(att.attrs);
  const arr: [number, DmgType, string][] = [
    [m, "melee", "⚔️"],
    [mg, "magic", "✨"],
    [rg, "ranged", "🏹"],
    [mt, "mental", "🧠"],
  ];
  arr.sort((a, b) => b[0] - a[0]);
  const [base, dtype, icon] = arr[0];
  return { base, dtype, icon };
}
function resist(def: Unit, dtype: DmgType): number {
  if (dtype === "melee") return resistPhysicalMelee(def.attrs);
  if (dtype === "ranged") return resistPhysicalRanged(def.attrs);
  if (dtype === "magic") return resistMagic(def.attrs);
  return resistMental(def.attrs);
}

/* ===== Resolução de ação ===== */
function tryHit(att: Unit, def: Unit): { miss: boolean; crit: boolean; trueDmg: boolean; accUsed: number; dodgeUsed: number } {
  const acc = accuracyPercent(att.level, def.level, att.hpMax, def.hpMax) + (att.buffs.accBonus ?? 0);
  const dodge = dodgeChance(def.attrs);
  const accRoll = clamp(acc - dodge, 5, 100);
  const miss = !roll(accRoll);
  const crit = !miss && roll(critChance(att.attrs));
  const trueDmg = !miss && roll(trueDamageChance(att.attrs));
  return { miss, crit, trueDmg, accUsed: accRoll, dodgeUsed: dodge };
}

function applyDamage(att: Unit, def: Unit, rawBase: number, dtype: DmgType, calc: Calc[], label: string) {
  let base = rawBase;
  if (att.buffs.dmgBonus) base = Math.floor(base * (1 + att.buffs.dmgBonus / 100));

  const h = tryHit(att, def);
  if (h.miss) {
    calc.push({ side: att.id, text: `${label}: errou • acc=${h.accUsed}% vs dodge=${h.dodgeUsed}%` });
    return { dmg: 0, miss: true, crit: false };
  }

  let res = h.trueDmg ? 0 : resist(def, dtype);
  if (def.id === "enemy" && att.id === "player" && att.buffs.enemyResDown) {
    res = Math.max(0, Math.floor(res * (1 - att.buffs.enemyResDown / 100)));
  }

  let dmg = Math.max(1, base - Math.floor(res * 0.35));
  if (h.crit) dmg = Math.floor((dmg * critMultiplier(att.attrs)) / 100);

  if (roll(damageReductionChance(def.attrs))) {
    dmg = Math.floor((dmg * (100 - damageReductionPercent)) / 100);
    calc.push({ side: def.id, text: `redução de dano acionada (-${damageReductionPercent}%)` });
  }

  calc.push({
    side: att.id,
    text: `${label}: base=${base} • res=${res} • ${h.crit ? "CRIT" : "HIT"} • true=${h.trueDmg ? "sim" : "não"} • final=${dmg}`,
  });

  def.hp = clamp(def.hp - dmg, 0, def.hpMax);
  return { dmg, miss: false, crit: h.crit };
}

function doBasic(att: Unit, def: Unit, log: Log[], calc: Calc[]) {
  const b = bestBasic(att);
  att.nextIcon = b.icon;
  const r = applyDamage(att, def, b.base, b.dtype, calc, "Ataque básico");
  if (!r.miss) log.push({ side: att.id, text: `${att.name} causa ${r.dmg} de dano (${r.crit ? "crit" : "hit"})` });
  else log.push({ side: "neutral", text: `${att.name} erra o ataque` });
}

function doSkill(att: Unit, def: Unit, id: SkillId | undefined, log: Log[], calc: Calc[]) {
  if (!id) return doBasic(att, def, log, calc);
  let base = 0 as number;
  let dtype: DmgType = "melee";
  let mpCost = 0;
  let label = "";

  switch (id) {
    case "golpe_poderoso":
      base = Math.floor(meleeAttack(att.attrs) * 1.3);
      dtype = "melee"; mpCost = 10; label = "Golpe Poderoso"; att.nextIcon = "💥"; break;
    case "explosao_arcana":
      base = Math.floor(magicAttack(att.attrs) * 1.5);
      dtype = "magic"; mpCost = 12; label = "Explosão Arcana"; att.nextIcon = "🪄"; break;
    case "tiro_preciso":
      base = Math.floor(rangedAttack(att.attrs) * 1.4);
      dtype = "ranged"; mpCost = 8; label = "Tiro Preciso"; att.nextIcon = "🎯"; break;
    default:
      return doBasic(att, def, log, calc);
  }

  if (att.mp < mpCost) {
    calc.push({ side: att.id, text: `${label}: MP insuficiente (${att.mp}/${mpCost})` });
    return doBasic(att, def, log, calc);
  }
  att.mp -= mpCost;

  const r = applyDamage(att, def, base, dtype, calc, label);
  if (!r.miss) log.push({ side: att.id, text: `${att.name} usa ${label} e causa ${r.dmg} de dano (${r.crit ? "crit" : "hit"})` });
  else log.push({ side: "neutral", text: `${att.name} erra ${label}` });
}

function doBuff(att: Unit, def: Unit, id: BuffId | undefined, log: Log[], calc: Calc[]) {
  switch (id) {
    case "foco":
      att.buffs.accBonus = 20; att.buffs.turns = 2; att.nextIcon = "🎯";
      log.push({ side: "neutral", text: `${att.name} usa Foco (+20% acerto por 2 turnos)` });
      calc.push({ side: att.id, text: `buff: +20% acc` });
      break;
    case "fortalecer":
      att.buffs.dmgBonus = 15; att.buffs.turns = 2; att.nextIcon = "🗡️";
      log.push({ side: "neutral", text: `${att.name} usa Fortalecer (+15% dano por 2 turnos)` });
      calc.push({ side: att.id, text: `buff: +15% dano` });
      break;
    case "enfraquecer":
      att.buffs.enemyResDown = 15; att.buffs.turns = 2; att.nextIcon = "🪓";
      log.push({ side: "neutral", text: `${att.name} lança Enfraquecer (-15% resist do alvo por 2 turnos)` });
      calc.push({ side: att.id, text: `debuff alvo: -15% resist` });
      break;
    default:
      log.push({ side: "neutral", text: `${att.name} prepara-se` });
  }
}

/* ===== aqui a mudança: cmd vai por último ===== */
function fullAction(att: Unit, def: Unit, log: Log[], calc: Calc[], cmd?: ClientCmd) {
  if (cmd?.kind === "skill") doSkill(att, def, cmd.id, log, calc);
  else doBasic(att, def, log, calc);
  att.usedFull = true;
}
function bonusAction(att: Unit, def: Unit, log: Log[], calc: Calc[], cmd?: ClientCmd) {
  if (cmd?.kind === "buff") {
    doBuff(att, def, cmd.id, log, calc);
    att.usedBonus = true;
  }
}

/* ===== Loop de ATB ===== */
function speed(u: Unit) { return 0.4 + attackSpeed(u.attrs) * 0.08; }
function gain(u: Unit)  { u.atb = clamp(u.atb + speed(u), 0, 120); }
function spend(u: Unit) {
  u.atb = clamp(u.atb - 100, 0, 120);
  u.usedFull = false;
  u.usedBonus = false;
  applyBuffDecay(u);
}

/* ===== AI simples ===== */
function chooseAI(att: Unit, def: Unit): ClientCmd {
  const canStrong = att.mp >= 10 && meleeAttack(att.attrs) >= magicAttack(att.attrs);
  const canArcane = att.mp >= 12 && magicAttack(att.attrs) > meleeAttack(att.attrs);
  if ((canStrong || canArcane) && Math.random() < 0.7) {
    return { kind: "skill", id: canArcane ? "explosao_arcana" : "golpe_poderoso" };
  }
  if (!att.usedBonus && Math.random() < 0.35) {
    return { kind: "buff", id: ["foco", "fortalecer", "enfraquecer"][rnd(3)] as BuffId };
  }
  return { kind: "basic" };
}

/* ===== API de alto nível ===== */
export function startCombat(): PublicSnapshot {
  const player = buildUnit("player", "Você", 1, { str: 12, dex: 10, intt: 10, wis: 10, con: 12, cha: 10, luck: 10 });
  const enemy  = buildUnit("enemy", "Satyr Camp", 6, { str: 12, dex: 9, intt: 8, wis: 7, con: 7, cha: 7, luck: 6 });

  const srv: ServerState = { player, enemy, log: [], calc: [] };
  const snap: PublicSnapshot = { player: copyPub(player), enemy: copyPub(enemy), log: [], calc: [], srv };
  return snap;
}

export function stepCombat(prevSrv: ServerState, cmd?: ClientCmd): PublicSnapshot {
  const s: ServerState = JSON.parse(JSON.stringify(prevSrv));
  const { player, enemy, log, calc } = s;

  let acted = false;
  for (let guard = 0; guard < 999; guard++) {
    if (player.hp <= 0 || enemy.hp <= 0) break;

    if (player.atb >= 100 || enemy.atb >= 100) {
      const turnOrder: Unit[] = [player, enemy].sort((a, b) => b.atb - a.atb || (a.id === "player" ? -1 : 1));

      for (const u of turnOrder) {
        if (u.hp <= 0) continue;
        if (u.atb < 100) continue;

        const me  = u;
        const foe = me.id === "player" ? enemy : player;
        const op  = me.id === "player" ? cmd : chooseAI(me, foe);

        if (!me.usedBonus && op?.kind === "buff") bonusAction(me, foe, log, calc, op);
        if (!me.usedFull) fullAction(me, foe, log, calc, op);

        spend(me);
        acted = true;
        if (player.hp <= 0 || enemy.hp <= 0) break;
      }

      if (acted) break;
    }

    gain(player);
    gain(enemy);
  }

  return {
    player: copyPub(player),
    enemy: copyPub(enemy),
    log,
    calc,
    srv: s,
  };
}
