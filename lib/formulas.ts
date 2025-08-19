// lib/formulas.ts

// ==== Tipos utilitários ====
export type Attrs = {
  str: number; dex: number; intt: number; wis: number; cha: number; con: number; luck: number; level: number;
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

// ==== Subatributos base (mantém sua lógica atual) ====
export const calcHP = (a: Attrs) => 30 + a.level * 5 + a.con * 1;
export const calcMP = (a: Attrs, main: number) => 30 + a.level * 5 + main + (a.con * 0.5);

export const meleeAttack   = (a: Attrs) => a.str + Math.floor(a.dex * 0.5);
export const rangedAttack  = (a: Attrs) => a.dex + Math.floor(a.str * 0.5);
export const magicAttack   = (a: Attrs) => a.intt;
export const mentalAttack  = (a: Attrs) => a.wis;

export const resistPhysicalMelee   = (a: Attrs) => a.str + Math.floor(a.con * 0.5);
export const resistPhysicalRanged  = (a: Attrs) => a.dex + Math.floor(a.con * 0.5);
export const resistMagic           = (a: Attrs) => a.intt + Math.floor(a.con * 0.5);
export const resistMental          = (a: Attrs) => a.wis + Math.floor(a.con * 0.5);

export const atkSpeed  = (a: Attrs) => a.dex;
export const castSpeed = (a: Attrs) => a.wis;

export const dodgeChance = (a: Attrs) => a.luck + Math.floor(a.dex * 0.5);

// crítico/ofensa/defesa de crítico (seu padrão atual)
export const critChance    = (a: Attrs) => a.luck;          // %
export const critMultiplier = (a: Attrs) => (a.cha / 20) + 1;// x
export const critDefense   = (a: Attrs) => a.cha;           // %

export const trueDamageChance       = (a: Attrs) => a.wis;  // %
export const damageReductionChance  = (a: Attrs) => a.cha;  // %

/** Precisão (mantém sua ideia: level e maior atributo pesam) */
export function accuracyPercent(attacker: Attrs, defender: Attrs) {
  const atkMain = Math.max(attacker.str, attacker.dex, attacker.intt);
  const defMain = Math.max(defender.str, defender.dex, defender.intt);
  let acc = 100 + (attacker.level - defender.level) * 5 + (atkMain - defMain) * 2;
  return clamp(acc, 0, 100);
}

// ==== (NOVO) Escala simples de inimigo por TIER ====
// Regra: +15% por tier acima do 1 (arredondando para baixo).
// Ex.: tier=1 => f = 1.00 | tier=2 => 1.15 | tier=3 => 1.30 ...
export function scaleEnemy(base: Attrs, tier: number): Attrs {
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
