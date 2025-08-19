// lib/formulas.ts

// Tipagem de atributos (a mesma usada no restante do projeto)
export type Attr = {
  str: number; dex: number; intt: number; wis: number; cha: number; con: number; luck: number; level: number;
};

// util
export const clamp = (v:number, lo:number, hi:number) => Math.max(lo, Math.min(hi, v));

// -------------------- Subatributos básicos --------------------
export const hp  = (a: Attr) => 30 + a.level * 5 + a.con * 1;
export const mp  = (a: Attr, main:number) => 30 + a.level * 5 + main + a.con * 0.5;

export const atkSpeed  = (a: Attr) => a.dex;
export const castSpeed = (a: Attr) => a.wis;

// -------------------- Resistências --------------------
export const resistPhysicalMelee  = (a: Attr) => a.str + a.con * 0.5;
export const resistPhysicalRanged = (a: Attr) => a.dex + a.con * 0.5;
export const resistMagic          = (a: Attr) => a.intt + a.con * 0.5;
export const resistMental         = (a: Attr) => a.wis  + a.con * 0.5;

// -------------------- Chances --------------------
export const dodgeChance = (a: Attr) => a.luck + a.dex * 0.5;
export const critChance  = (a: Attr) => a.luck;

// -------------------- Ataques base --------------------
export const physicalMeleeAttack   = (a: Attr) => a.str + a.dex * 0.5;
export const physicalRangedAttack  = (a: Attr) => a.dex + a.str * 0.5;
export const magicAttack           = (a: Attr) => a.intt;
export const mentalAttack          = (a: Attr) => a.wis;

// -------------------- Precisão --------------------
export function accuracyPercent(attacker: Attr, defender: Attr) {
  const mainAtk = Math.max(attacker.str, attacker.dex, attacker.intt);
  const mainDef = Math.max(defender.str, defender.dex, defender.intt);
  let acc = 100 + (attacker.level - defender.level) * 5 + (mainAtk - mainDef) * 2;
  return clamp(acc, 0, 100);
}

// -------------------- Util de dano --------------------
export const damageClamp = (x:number) => clamp(Math.floor(x), 1, 9999);

// -------------------- ESCALA DE INIMIGO POR TIER --------------------
// +15% por tier acima de 1 (arredondando para baixo). Sobe também o level.
export function scaleEnemy(base: Attr, tier: number): Attr {
  const t = Math.max(1, Math.floor(tier || 1));
  const f = 1 + (t - 1) * 0.15;

  return {
    level: base.level + (t - 1),
    str:  Math.floor(base.str  * f),
    dex:  Math.floor(base.dex  * f),
    intt: Math.floor(base.intt * f),
    wis:  Math.floor(base.wis  * f),
    cha:  Math.floor(base.cha  * f),
    con:  Math.floor(base.con  * f),
    luck: Math.floor(base.luck * f),
  };
}
