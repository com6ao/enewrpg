// lib/formulas.ts
export type Attr = {str:number,dex:number,intt:number,wis:number,cha:number,con:number};
export type LevelPack = {level:number};
const clamp = (v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));

export const hp = (a:Attr,l:LevelPack)=> 30 + (l.level-1)*5 + a.con*1;
export const mpMain = (a:Attr,l:LevelPack,main:'str'|'dex'|'intt')=> 30 + (l.level-1)*5 + a[main] + Math.floor(a.con*0.5);

export const meleeAttack = (a:Attr)=> a.str + Math.floor(a.dex*0.5);
export const rangedAttack= (a:Attr)=> a.dex + Math.floor(a.str*0.5);
export const magicAttack = (a:Attr)=> a.intt;

export const resistPhysicalMelee =(a:Attr)=> a.str + Math.floor(a.dex*0.5) + a.con;
export const resistPhysicalRanged=(a:Attr)=> a.dex + Math.floor(a.str*0.5) + a.con;
export const resistMagic       =(a:Attr)=> a.intt + a.con;
export const resistMental      =(a:Attr)=> a.wis  + a.con;
export const resistCrit        =(a:Attr)=> a.cha;

export const attackSpeed=(a:Attr)=>a.dex;
export const castSpeed  =(a:Attr)=>a.wis;

export const critChance =(a:Attr)=>clamp(a.dex*2,0,60);         // %
export const critMultiplier=(a:Attr)=>150 + Math.floor(a.cha*1.5); // %
export const trueDamageChance=(a:Attr)=>clamp(a.wis*2,0,50);    // %
export const damageReductionChance=(a:Attr)=>clamp(a.cha*2,0,60); // %
export const damageReductionPercent=80;

export function dodgeChance(a:Attr){
  const luck = Math.floor(a.cha/2); // suposição
  return clamp(luck + Math.floor(a.dex*0.5),0,95);
}
export function accuracyPercent(atkLv:number,defLv:number,atkMax:number,defMax:number){
  let acc=100;
  if(defLv>atkLv) acc -= (defLv-atkLv)*5;
  if(defMax>atkMax) acc -= (defMax-atkMax)*2;
  return clamp(acc,5,100);
}

