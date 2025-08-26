// lib/combat.ts
import {
  Attr, clamp, hp, mpMain,
  meleeAttack, rangedAttack, magicAttack, mentalAttack,
  resistPhysicalMelee, resistPhysicalRanged, resistMagic, resistMental,
  resistByKind, bestBasic, estimateDamage, accuracyFinal,
  attackSpeed, critChance, critMultiplier, trueDamageChance,
  damageReductionChance, damageReductionPercent,
  dodgeChance, accuracyPercent
  dodgeChance,
  type DmgKind
} from "./formulas";

export type Calc = { text:string; side:"player"|"enemy" };
export type Log  = { text:string; side:"neutral"|"player"|"enemy" };

export type Unit = {
  id:"player"|"enemy"; name:string; level:number; attrs:Attr;
  hp:number; hpMax:number; mp:number; mpMax:number; atb:number;
  usedFull?:boolean; usedBonus?:boolean;
  buffs:{ accBonus?:number; dmgBonus?:number; enemyResDown?:number; turns?:number };
  nextIcon?:string;
};

export type ServerState = {
  player:Unit; enemy:Unit; log:Log[]; calc:Calc[]; stage:number; gold:number;
};

type SkillId = "golpe_poderoso" | "explosao_arcana" | "tiro_preciso";
type BuffId  = "foco" | "fortalecer" | "enfraquecer";

export type ClientCmd =
  | { kind:"basic" }
  | { kind:"skill"; id?: SkillId }
  | { kind:"buff";  id?: BuffId };

export type PublicSnapshot = {
  player:{ id:"player"; name:string; level:number; hp:number; hpMax:number; mp:number; mpMax:number; atb:number; nextIcon?:string };
  enemy: { id:"enemy";  name:string; level:number; hp:number; hpMax:number; mp:number; mpMax:number; atb:number; nextIcon?:string };
  log:Log[]; calc:Calc[]; srv:ServerState;
};

const copyPub = (u:Unit)=>
  ({ id:u.id, name:u.name, level:u.level, hp:u.hp, hpMax:u.hpMax, mp:u.mp, mpMax:u.mpMax, atb:u.atb, nextIcon:u.nextIcon }) as
    PublicSnapshot["player"]|PublicSnapshot["enemy"];

const rnd=(n:number)=>Math.floor(Math.random()*n);
const roll=(pct:number)=>Math.random()*100<pct;

function applyBuffDecay(u:Unit){ if(u.buffs.turns&&u.buffs.turns>0){ u.buffs.turns!--; if(u.buffs.turns<=0) u.buffs={}; } }

function defaultAttrs():Attr{ return {str:10,dex:10,intt:10,wis:10,cha:10,con:10,luck:10}; }
function buildUnit(id:"player"|"enemy",name:string,level:number,attrs?:Partial<Attr>):Unit{
  const a:Attr={...defaultAttrs(),...attrs};
  const main:'str'|'dex'|'intt' = a.intt>=a.str&&a.intt>=a.dex ? 'intt' : a.str>=a.dex ? 'str' : 'dex';
  const mp0=mpMain(a,{level},main);
  const hp0=hp(a,{level});
  return { id,name,level,attrs:a,hp:hp0,hpMax:hp0,mp:mp0,mpMax:mp0,atb:0,buffs:{} };
}

type DmgType="melee"|"magic"|"ranged"|"mental";
function bestBasic(att:Unit){ const arr:[number,DmgType,string][]=[
  [meleeAttack(att.attrs),"melee","⚔️"],
  [magicAttack(att.attrs),"magic","✨"],
  [rangedAttack(att.attrs),"ranged","🏹"],
  [mentalAttack(att.attrs),"mental","🧠"],
]; arr.sort((a,b)=>b[0]-a[0]); const [base,dtype,icon]=arr[0]; return {base,dtype,icon}; }
function resist(def:Unit,t:DmgType){ return t==="melee"?resistPhysicalMelee(def.attrs):t==="ranged"?resistPhysicalRanged(def.attrs):t==="magic"?resistMagic(def.attrs):resistMental(def.attrs); }
const basicIcons:Record<DmgKind,string>={melee:"⚔️",magic:"✨",ranged:"🏹",mental:"🧠"};

function tryHit(att:Unit,def:Unit){
  const acc=accuracyPercent(att.level,def.level)+(att.buffs.accBonus??0);
  const dodge=dodgeChance(def.attrs);
  const accRoll=clamp(acc-dodge,5,100);
  const accRoll=accuracyFinal(att.level,def.level,def.attrs,att.buffs.accBonus??0);
  const miss=!roll(accRoll);
  const crit=!miss&&roll(critChance(att.attrs));
  const trueDmg=!miss&&roll(trueDamageChance(att.attrs));
  return {miss,crit,trueDmg,accUsed:accRoll,dodgeUsed:dodge};
}

function applyDamage(att:Unit,def:Unit,rawBase:number,dtype:DmgType,calc:Calc[],label:string){
function applyDamage(att:Unit,def:Unit,rawBase:number,kind:DmgKind,calc:Calc[],label:string){
  let base=rawBase; if(att.buffs.dmgBonus) base=Math.floor(base*(1+att.buffs.dmgBonus/100));
  const h=tryHit(att,def); if(h.miss){ calc.push({side:att.id,text:`${label}: errou • acc=${h.accUsed}% vs dodge=${h.dodgeUsed}%`}); return {dmg:0,miss:true,crit:false}; }
  let res=h.trueDmg?0:resist(def,dtype);
  let res=h.trueDmg?0:resistByKind(def.attrs,kind);
  if(def.id==="enemy"&&att.id==="player"&&att.buffs.enemyResDown){ res=Math.max(0,Math.floor(res*(1-(att.buffs.enemyResDown/100)))); }
  let dmg=Math.max(1, base - Math.floor(res*0.35));
  let dmg=estimateDamage(base,res);
  if(h.crit) dmg=Math.floor((dmg*critMultiplier(att.attrs))/100);
  if(roll(damageReductionChance(def.attrs))){ dmg=Math.floor((dmg*(100-damageReductionPercent))/100); calc.push({side:def.id,text:`redução de dano acionada (-${damageReductionPercent}%)`}); }
  calc.push({side:att.id,text:`${label}: base=${base} • res=${res} • ${h.crit?"CRIT":"HIT"} • true=${h.trueDmg?"sim":"não"} • final=${dmg}`});
  def.hp=clamp(def.hp-dmg,0,def.hpMax); return {dmg,miss:false,crit:h.crit};
}

function doBasic(att:Unit,def:Unit,log:Log[],calc:Calc[]){
  const b=bestBasic(att); att.nextIcon=b.icon;
  const r=applyDamage(att,def,b.base,b.dtype,calc,"Ataque básico");
  const b=bestBasic(att.attrs); att.nextIcon=basicIcons[b.kind];
  const r=applyDamage(att,def,b.base,b.kind,calc,"Ataque básico");
  log.push(r.miss?{side:"neutral",text:`${att.name} erra o ataque`}:{side:att.id,text:`${att.name} causa ${r.dmg} de dano (${r.crit?"crit":"hit"})`});
}

function doSkill(att:Unit,def:Unit,id:SkillId|undefined,log:Log[],calc:Calc[]){
  if(!id) return doBasic(att,def,log,calc);
  let base=0, dtype:DmgType="melee", mpCost=0, label="";
  let base=0, kind:DmgKind="melee", mpCost=0, label="";
  switch(id){
    case "golpe_poderoso": base=Math.floor(meleeAttack(att.attrs)*1.3); dtype="melee";  mpCost=10; label="Golpe Poderoso";  att.nextIcon="💥"; break;
    case "explosao_arcana":base=Math.floor(magicAttack(att.attrs)*1.5); dtype="magic";  mpCost=12; label="Explosão Arcana"; att.nextIcon="🪄"; break;
    case "tiro_preciso":  base=Math.floor(rangedAttack(att.attrs)*1.4);dtype="ranged"; mpCost=8;  label="Tiro Preciso";    att.nextIcon="🎯"; break;
    case "golpe_poderoso": base=Math.floor(meleeAttack(att.attrs)*1.3); kind="melee";  mpCost=10; label="Golpe Poderoso";  att.nextIcon="💥"; break;
    case "explosao_arcana":base=Math.floor(magicAttack(att.attrs)*1.5); kind="magic";  mpCost=12; label="Explosão Arcana"; att.nextIcon="🪄"; break;
    case "tiro_preciso":  base=Math.floor(rangedAttack(att.attrs)*1.4);kind="ranged"; mpCost=8;  label="Tiro Preciso";    att.nextIcon="🎯"; break;
  }
  if(att.mp<mpCost){ calc.push({side:att.id,text:`${label}: MP insuficiente (${att.mp}/${mpCost})`}); return doBasic(att,def,log,calc); }
  att.mp-=mpCost;
  const r=applyDamage(att,def,base,dtype,calc,label);
  const r=applyDamage(att,def,base,kind,calc,label);
  log.push(r.miss?{side:"neutral",text:`${att.name} erra ${label}`}:{side:att.id,text:`${att.name} usa ${label} e causa ${r.dmg} de dano (${r.crit?"crit":"hit"})`});
}

function doBuff(att:Unit,_def:Unit,id:BuffId|undefined,log:Log[],calc:Calc[]){
  switch(id){
    case "foco":        att.buffs.accBonus=20;  att.buffs.turns=2; att.nextIcon="🎯"; log.push({side:"neutral",text:`${att.name} usa Foco (+20% acerto por 2 turnos)`});        calc.push({side:att.id,text:`buff: +20% acc`}); break;
    case "fortalecer":  att.buffs.dmgBonus=15;  att.buffs.turns=2; att.nextIcon="🗡️"; log.push({side:"neutral",text:`${att.name} usa Fortalecer (+15% dano por 2 turnos)`});    calc.push({side:att.id,text:`buff: +15% dano`}); break;
    case "enfraquecer": att.buffs.enemyResDown=15; att.buffs.turns=2; att.nextIcon="🪓"; log.push({side:"neutral",text:`${att.name} lança Enfraquecer (-15% resist do alvo por 2 turnos)`}); calc.push({side:att.id,text:`debuff alvo: -15% resist`}); break;
    default:            log.push({side:"neutral",text:`${att.name} prepara-se`});
  }
}

function fullAction(att:Unit,def:Unit,log:Log[],calc:Calc[],cmd?:ClientCmd){
  if(cmd?.kind==="skill") doSkill(att,def,cmd.id,log,calc); else doBasic(att,def,log,calc);
  att.usedFull=true;
}
function bonusAction(att:Unit,def:Unit,log:Log[],calc:Calc[],cmd?:ClientCmd){
  if(cmd?.kind==="buff"){ doBuff(att,def,cmd.id,log,calc); att.usedBonus=true; }
}

function speed(u:Unit){ return 0.4+attackSpeed(u.attrs)*0.08; }
function gain(u:Unit){ u.atb=clamp(u.atb+speed(u),0,120); }
function spend(u:Unit){ u.atb=clamp(u.atb-100,0,120); u.usedFull=false; u.usedBonus=false; applyBuffDecay(u); }

function chooseAI(att:Unit,def:Unit):ClientCmd{
