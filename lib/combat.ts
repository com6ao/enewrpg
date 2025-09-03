// lib/combat.ts
import {
  Attr, clamp, hp, mpMain,
  meleeAttack, rangedAttack, magicAttack, mentalAttack,
  resistByKind, bestBasic, estimateDamage, accuracyFinal,
  attackSpeed, critChance, critMultiplier, trueDamageChance,
  damageReductionChance, damageReductionPercent,
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
  player:Unit; enemy:Unit; log:Log[]; calc:Calc[]; stage:number; gold:number; xp:number;
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
  log:Log[]; calc:Calc[]; srv:ServerState; enemyDefeated?:boolean; xpGain?:number; levelUp?:boolean;
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

const basicIcons:Record<DmgKind,string>={melee:"⚔️",magic:"✨",ranged:"🏹",mental:"🧠"};

function tryHit(att:Unit,def:Unit){
  const dodge=dodgeChance(def.attrs);
  const accRoll=accuracyFinal(att.level,def.level,def.attrs,att.buffs.accBonus??0);
  const miss=!roll(accRoll);
  const crit=!miss&&roll(critChance(att.attrs));
  const trueDmg=!miss&&roll(trueDamageChance(att.attrs));
  return {miss,crit,trueDmg,accUsed:accRoll,dodgeUsed:dodge};
}

function applyDamage(att:Unit,def:Unit,rawBase:number,kind:DmgKind,calc:Calc[],label:string){
  let base=rawBase; if(att.buffs.dmgBonus) base=Math.floor(base*(1+att.buffs.dmgBonus/100));
  const h=tryHit(att,def); if(h.miss){ calc.push({side:att.id,text:`${label}: errou • acc=${h.accUsed}% vs dodge=${h.dodgeUsed}%`}); return {dmg:0,miss:true,crit:false}; }
  let res=h.trueDmg?0:resistByKind(def.attrs,kind);
  if(def.id==="enemy"&&att.id==="player"&&att.buffs.enemyResDown){ res=Math.max(0,Math.floor(res*(1-(att.buffs.enemyResDown/100)))); }
  let dmg=estimateDamage(base,res);
  if(h.crit) dmg=Math.floor((dmg*critMultiplier(att.attrs))/100);
  if(roll(damageReductionChance(def.attrs))){ dmg=Math.floor((dmg*(100-damageReductionPercent))/100); calc.push({side:def.id,text:`redução de dano acionada (-${damageReductionPercent}%)`}); }
  calc.push({side:att.id,text:`${label}: base=${base} • res=${res} • ${h.crit?"CRIT":"HIT"} • true=${h.trueDmg?"sim":"não"} • final=${dmg}`});
  def.hp=Math.max(0,Math.min(def.hpMax,def.hp-dmg)); return {dmg,miss:false,crit:h.crit};
}

function doBasic(att:Unit,def:Unit,log:Log[],calc:Calc[]){
  const b=bestBasic(att.attrs); att.nextIcon=basicIcons[b.kind];
  const r=applyDamage(att,def,b.base,b.kind,calc,"Ataque básico");
  log.push(r.miss?{side:"neutral",text:`${att.name} erra o ataque`}:{side:att.id,text:`${att.name} causa ${r.dmg} de dano (${r.crit?"crit":"hit"})`});
}

function doSkill(att:Unit,def:Unit,id:SkillId|undefined,log:Log[],calc:Calc[]){
  if(!id) return doBasic(att,def,log,calc);
  let base=0, kind:DmgKind="melee", mpCost=0, label="";
  switch(id){
    case "golpe_poderoso": base=Math.floor(meleeAttack(att.attrs)*1.3); kind="melee";  mpCost=10; label="Golpe Poderoso";  att.nextIcon="💥"; break;
    case "explosao_arcana":base=Math.floor(magicAttack(att.attrs)*1.5); kind="magic";  mpCost=12; label="Explosão Arcana"; att.nextIcon="🪄"; break;
    case "tiro_preciso":  base=Math.floor(rangedAttack(att.attrs)*1.4);kind="ranged"; mpCost=8;  label="Tiro Preciso";    att.nextIcon="🎯"; break;
  }
  if(att.mp<mpCost){ calc.push({side:att.id,text:`${label}: MP insuficiente (${att.mp}/${mpCost})`}); return doBasic(att,def,log,calc); }
  att.mp-=mpCost;
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
function gain(u:Unit){ u.atb=Math.max(0,Math.min(120,u.atb+speed(u))); }
function spend(u:Unit){ u.atb=Math.max(0,Math.min(120,u.atb-100)); u.usedFull=false; u.usedBonus=false; applyBuffDecay(u); }

function chooseAI(att:Unit,def:Unit):ClientCmd{
  const canStrong=att.mp>=10 && meleeAttack(att.attrs)>=magicAttack(att.attrs);
  const canArcane=att.mp>=12 && magicAttack(att.attrs)> meleeAttack(att.attrs);
  if((canStrong||canArcane)&&Math.random()<0.7) return {kind:"skill",id: canArcane?"explosao_arcana":"golpe_poderoso"};
  if(!att.usedBonus && Math.random()<0.35) return {kind:"buff",id:["foco","fortalecer","enfraquecer"][rnd(3)] as BuffId};
  return {kind:"basic"};
}

const enemyPools:string[][]=[
  ["Rato Selvagem","Rato Gigante"],
  ["Lobo Faminto","Lobo das Sombras"],
  ["Goblin Batedor","Goblin Arqueiro"],
  ["Orc Guerreiro","Orc Bruto"],
  ["Troll das Cavernas","Troll da Montanha"],
  ["Mago Negro","Bruxo Sombrio"],
  ["Dragão Jovem","Dragão Rubro"],
  ["Quimera","Quimera Alfa"],
  ["Titã de Pedra","Titã de Ferro"],
  ["Anjo Caído","Arcanjo Corrompido"],
];

const namePrefixes=["Ancião","Sombrio","Corrompido","Guardião","Bestial","Fantasmagórico"];
const nameSuffixes=["do Abismo","das Sombras","da Ruína","Eterno","Supremo","do Caos"];

function spawnEnemy(stage:number):Unit{
  const base=stage;
  let name:string;
  const pool=enemyPools[stage-1];
  if(pool){
    name=pool[rnd(pool.length)];
  }else{
    name=`${namePrefixes[rnd(namePrefixes.length)]} ${nameSuffixes[rnd(nameSuffixes.length)]}`;
  }
  const bonus=Math.max(0,stage-enemyPools.length);
  return buildUnit("enemy",name,
    base,{
      str:8+stage+bonus, dex:7+Math.floor(stage*0.8)+bonus, intt:6+Math.floor(stage*0.6)+bonus,
      wis:6+Math.floor(stage*0.5)+bonus, con:7+stage+bonus, cha:6+Math.floor(stage*0.3)+bonus, luck:6+Math.floor(stage*0.3)+bonus
    });
}

function xpForNextLevel(level:number){ return level*100; }

export function startCombat(
  opts?: { name?: string; level?: number; xp?: number; attrs?: Partial<Attr> },
  gold?: number,
): PublicSnapshot {
  const pName = opts?.name ?? "Você";
  const pLevel = opts?.level ?? 1;
  const pAttrs: Partial<Attr> = opts?.attrs ?? {
    str: 12,
    dex: 10,
    intt: 10,
    wis: 10,
    con: 12,
    cha: 10,
    luck: 14,
  };
  const player = buildUnit("player", pName, pLevel, pAttrs);
  const enemy = spawnEnemy(1);
  const srv: ServerState = {
    player,
    enemy,
    log: [],
    calc: [],
    stage: 1,
    gold: gold ?? 0,
    xp: opts?.xp ?? 0,
  };
  return { player: copyPub(player) as any, enemy: copyPub(enemy) as any, log: [], calc: [], srv, enemyDefeated:false };
}

export function stepCombat(prev:ServerState, cmd?:ClientCmd):PublicSnapshot{
  const s:ServerState=JSON.parse(JSON.stringify(prev));
  const {player,enemy,log,calc}=s;

  let acted=false;
  for(let guard=0; guard<999; guard++){
    if(player.hp<=0||enemy.hp<=0) break;

    if(player.atb>=100||enemy.atb>=100){
      const order:[Unit,Unit]=[player,enemy].sort((a,b)=>b.atb-a.atb || (a.id==="player"?-1:1)) as any;

      for(const u of order){
        if(u.hp<=0||u.atb<100) continue;

        const me=u, foe=me.id==="player"?enemy:player;
        const op=me.id==="player"?cmd:chooseAI(me,foe);

        if(!me.usedBonus && op?.kind==="buff") bonusAction(me,foe,log,calc,op);
        if(!me.usedFull)  fullAction(me,foe,log,calc,op);

        spend(me); acted=true;
        if(player.hp<=0||enemy.hp<=0) break;
      }

      if(acted) break;
    }

    gain(player); gain(enemy);
  }

  let enemyDefeated=false;
  let xpGain=0;
  let leveledUp=false;
  if(enemy.hp<=0 && player.hp>0){
    enemyDefeated=true;
    const drop=3+Math.floor(Math.random()*5)+s.stage*2;
    s.gold+=drop;
    log.push({side:"neutral",text:`Você derrotou ${prev.enemy.name} e ganhou ${drop} ouro.`});

    xpGain = s.stage * 10;
    if(xpGain>0){
      s.xp += xpGain;
      log.push({side:"neutral",text:`Você ganhou ${xpGain} XP.`});
      while(s.xp >= xpForNextLevel(s.player.level)){
        s.xp -= xpForNextLevel(s.player.level);
        s.player.level += 1;
        leveledUp=true;
        log.push({side:"neutral",text:`Você subiu para o nível ${s.player.level}!`});
      }
    }

    s.stage+=1;
    s.enemy=spawnEnemy(s.stage);

    s.player.hp=Math.max(0,Math.min(s.player.hpMax,s.player.hp+Math.floor(s.player.hpMax*0.03)));
    s.player.mp=Math.max(0,Math.min(s.player.mpMax,s.player.mp+Math.floor(s.player.mpMax*0.03)));
  }

  return { player:copyPub(s.player) as any, enemy:copyPub(s.enemy) as any, log, calc, srv:s, enemyDefeated, xpGain, levelUp:leveledUp };
}
