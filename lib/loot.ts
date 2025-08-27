import { GearSlot, StatKey, Rarity, GearItem, GearStat, RARITY } from './types';

const SLOTS: GearSlot[] = ['weapon','helm','chest','gloves','pants','boots'];

const BASE_STATS: Record<GearSlot,{key:StatKey;min:number;max:number}> = {
  weapon:{key:'atk',min:10,max:30},
  helm:{key:'hp',min:20,max:40},
  chest:{key:'def',min:15,max:35},
  gloves:{key:'crit',min:1,max:5},
  pants:{key:'def',min:10,max:25},
  boots:{key:'spd',min:1,max:5},
};

const STAT_KEYS: StatKey[] = ['atk','def','hp','spd','crit'];

const SUBSTAT_RANGES: Record<StatKey,{min:number;max:number}> = {
  atk:{min:2,max:10},
  def:{min:2,max:10},
  hp:{min:5,max:25},
  spd:{min:1,max:3},
  crit:{min:1,max:5},
};

export const rollRarity = (rng:()=>number=Math.random):Rarity => {
  const total = Object.values(RARITY).reduce((s,r)=>s+r.weight,0);
  const roll = rng()*total;
  let acc = 0;
  for(const [rar,info] of Object.entries(RARITY) as [Rarity,{weight:number}][]){
    acc += info.weight;
    if(roll < acc) return rar;
  }
  return 'common';
};

export const rollSlot = (rng:()=>number=Math.random):GearSlot =>
  SLOTS[Math.floor(rng()*SLOTS.length)];

export const rollBaseForSlot = (slot:GearSlot,rng:()=>number=Math.random):GearStat => {
  const b = BASE_STATS[slot];
  const value = b.min + Math.floor(rng()*(b.max-b.min+1));
  return { key:b.key, value };
};

export const rollSubstats = (slot:GearSlot,rarity:Rarity,rng:()=>number=Math.random):GearStat[] => {
  const count = RARITY[rarity].substats;
  const available = STAT_KEYS.filter(k=>k!==BASE_STATS[slot].key);
  const subs: GearStat[] = [];
  for(let i=0;i<count && available.length>0;i++){
    const idx = Math.floor(rng()*available.length);
    const key = available.splice(idx,1)[0];
    const range = SUBSTAT_RANGES[key];
    const value = range.min + Math.floor(rng()*(range.max-range.min+1));
    subs.push({key,value});
  }
  return subs;
};

type PartialGear = { slot:GearSlot; rarity:Rarity; base:GearStat; substats:GearStat[] };

export const computeGearScore = (g:PartialGear):number =>
  g.base.value + g.substats.reduce((s,x)=>s+x.value,0);

export const generateItem = (rng:()=>number=Math.random):GearItem => {
  const slot = rollSlot(rng);
  const rarity = rollRarity(rng);
  const base = rollBaseForSlot(slot,rng);
  const substats = rollSubstats(slot,rarity,rng);
  const score = computeGearScore({slot,rarity,base,substats});
  return { slot, rarity, base, substats, score };
};

export const rollLoot = (
  count = 1,
  rng: () => number = Math.random
): GearItem[] =>
  Array.from({ length: count }, () => generateItem(rng));
