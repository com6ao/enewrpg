// lib/formulas.ts
export type Attr = { str:number; dex:number; intt:number; wis:number; cha:number; con:number; luck:number };
export type LevelPack = { level:number };

export const clamp = (v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));

export const hp = (a:Attr,l:LevelPack)=>30+(l.level-1)*5+a.con*1;
export const mpMain = (a:Attr,l:LevelPack,main:'str'|'dex'|'intt')=>30+(l.level-1)*5+a[main]+Math.floor(a.con*0.5);

// base damage
export const meleeAttack  = (a:Attr)=>Math.floor(a.str*1.8);
export const rangedAttack = (a:Attr)=>a.dex+Math.floor(a.str*0.5);
export const magicAttack  = (a:Attr)=>Math.floor(a.intt*1.8);
export const mentalAttack = (a:Attr)=>a.wis;

// resistances
export const resistPhysicalMelee  = (a:Attr)=>a.str+Math.floor(a.dex*0.5)+a.con;
export const resistPhysicalRanged = (a:Attr)=>a.dex+Math.floor(a.str*0.5)+a.con;
export const resistMagic          = (a:Attr)=>a.intt+a.con;
export const resistMental         = (a:Attr)=>a.wis+a.con;
export const resistCrit           = (a:Attr)=>a.cha;

// speeds
export const attackSpeed = (a:Attr)=>a.dex+a.wis;
export const castSpeed   = (a:Attr)=>a.wis;

// crit / reductions (valores da engine)
export const critChance            = (a:Attr)=>clamp(a.luck*0.4,0,60);
export const critMultiplier        = (a:Attr)=>150+Math.floor(a.cha*1.5);
export const trueDamageChance      = (a:Attr)=>clamp(a.wis*0.25,0,50);
export const damageReductionChance = (a:Attr)=>clamp(a.cha*0.15,0,60);
export const damageReductionPercent = 80;

// dodge/accuracy (valores da engine)
export const dodgeChance = (a:Attr)=>clamp(Math.floor(a.dex*0.3),0,55);
export const accuracyPercent = (atkLv:number,defLv:number)=>{
  let acc=100; if(defLv>atkLv) acc-=(defLv-atkLv)*10; return clamp(acc,30,100);
};

// shared helpers
export type DmgKind = "melee"|"magic"|"ranged"|"mental";
export const resistByKind = (a:Attr,k:DmgKind)=>
  k==="melee"?resistPhysicalMelee(a):
  k==="ranged"?resistPhysicalRanged(a):
  k==="magic"?resistMagic(a):
  resistMental(a);

export const bestBasic = (a:Attr)=>
  [
    { base: meleeAttack(a), kind: "melee" as DmgKind },
    { base: magicAttack(a), kind: "magic" as DmgKind },
    { base: rangedAttack(a), kind: "ranged" as DmgKind },
    { base: mentalAttack(a), kind: "mental" as DmgKind },
  ].sort((x,y)=>y.base-x.base)[0];

export const estimateDamage = (base:number,res:number)=>
  Math.max(1, base - Math.floor(res*0.35));

export const accuracyFinal = (
  attLevel:number,
  defLevel:number,
  defAttrs:Attr,
  accBonus=0
) => {
  const acc = accuracyPercent(attLevel, defLevel) + accBonus;
  const dodge = dodgeChance(defAttrs);
  return clamp(acc - dodge, 5, 100);
};
