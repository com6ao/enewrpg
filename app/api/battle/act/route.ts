import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

type Attrs = { str:number; dex:number; intt:number; wis:number; cha:number; con:number; luck:number };
type UnitState = { name:string; level:number; hp:number; hpMax:number; attrs:Attrs };
type UILog = {
  actor:"player"|"enemy"; type:"action_complete"; description:string;
  damage:number; damage_type:"hit"|"crit"|"miss"; formula:string; target_hp_after:number;
  bar_player_before:number; bar_player_after:number; bar_enemy_before:number; bar_enemy_after:number;
};
type StepsBody = { battle_id?:string; steps?:number };

const clamp = (n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));

function parseJSON<T>(v:any):T|null {
  if (v==null) return null;
  if (typeof v==="object") return v as T;
  if (typeof v==="string") { try{ return JSON.parse(v) as T; }catch{ return null; } }
  return null;
}
function extractAttrs(row:any, who:"player"|"enemy"): Attrs {
  const fromJson = parseJSON<Attrs>(row?.[`${who}_attrs`]);
  if (fromJson) return fromJson;
  return {
    str: Number(row?.[`${who}_str`] ?? 5),
    dex: Number(row?.[`${who}_dex`] ?? 5),
    intt: Number(row?.[`${who}_intt`] ?? 5),
    wis: Number(row?.[`${who}_wis`] ?? 5),
    cha: Number(row?.[`${who}_cha`] ?? 5),
    con: Number(row?.[`${who}_con`] ?? 5),
    luck: Number(row?.[`${who}_luck`] ?? 5),
  };
}
function toStates(row:any): { player:UnitState; enemy:UnitState } {
  const player:UnitState = {
    name: row.player_name ?? "Você",
    level: Number(row.player_level ?? 1),
    hp: Number(row.player_hp ?? 0),
    hpMax: Number(row.player_hp_max ?? row.player_hp ?? 1),
    attrs: extractAttrs(row,"player"),
  };
  const enemy:UnitState = {
    name: row.enemy_name ?? "Inimigo",
    level: Number(row.enemy_level ?? 1),
    hp: Number(row.enemy_hp ?? 0),
    hpMax: Number(row.enemy_hp_max ?? row.enemy_hp ?? 1),
    attrs: extractAttrs(row,"enemy"),
  };
  return { player, enemy };
}

// fórmulas
function speedOf(u:UnitState){ const {dex=0,wis=0}=u.attrs; return 0.4 + dex*0.05 + wis*0.03; }
function rng(luck:number){ const b=Math.random(); const L=clamp(luck,0,100)/100; return { base:b, crit:b>0.9-L*0.2, miss:b<0.05*(1-L*0.6) }; }
function attempt(atk:UnitState){
  const {str=0,intt=0,luck=0}=atk.attrs;
  const r=rng(luck);
  const miss=r.miss;
  const base=Math.max(1, Math.floor((str+intt)*1.2 + (atk.level??1)*0.5));
  const spread=0.8 + r.base*0.4;
  const crit=r.crit && !miss;
  const dmg=miss?0:Math.floor(base*spread*(crit?1.6:1));
  const kind = (miss?"miss":crit?"crit":"hit") as UILog["damage_type"];
  const desc=`Dano: ${dmg} (${kind})`;
  const formula = miss ? "miss" : `${base} * ${spread.toFixed(2)}${crit ? " * 1.6" : ""}`;
  return { dmg, kind, desc, formula };
}
function simulate(player:UnitState, enemy:UnitState, maxActions:number){
  let p={...player}, e={...enemy};
  let barP=0, barE=0; const spP=speedOf(p)*100, spE=speedOf(e)*100;
  let last:"player"|"enemy" = "enemy";
  const lines:UILog[]=[];

  while(lines.length<maxActions && p.hp>0 && e.hp>0){
    const needP=Math.max(0,100-barP), needE=Math.max(0,100-barE);
    const dt=Math.min(needP/spP, needE/spE);
    barP += spP*dt; barE += spE*dt;

    while((barP>=100 || barE>=100) && lines.length<maxActions && p.hp>0 && e.hp>0){
      const actor = barP>barE ? "player" : barE>barP ? "enemy" : (last==="enemy"?"player":"enemy");
      if (actor==="player"){
        const bP=Math.min(100,barP), bE=Math.min(100,barE);
        barP -= 100;
        const r=attempt(p);
        e={...e, hp: clamp(e.hp - r.dmg, 0, e.hpMax)};
        lines.push({
          actor:"player", type:"action_complete", description:r.desc,
          damage:r.dmg, damage_type:r.kind, formula:r.formula, target_hp_after:e.hp,
          bar_player_before:bP, bar_player_after:Math.max(0,barP),
          bar_enemy_before:bE,  bar_enemy_after:barE,
        });
        last="player";
      } else {
        const bP=Math.min(100,barP), bE=Math.min(100,barE);
        barE -= 100;
        const r=attempt(e);
        p={...p, hp: clamp(p.hp - r.dmg, 0, p.hpMax)};
        lines.push({
          actor:"enemy", type:"action_complete", description:r.desc,
          damage:r.dmg, damage_type:r.kind, formula:r.formula, target_hp_after:p.hp,
          bar_player_before:bP, bar_player_after:barP,
          bar_enemy_before:bE,  bar_enemy_after:Math.max(0,barE),
        });
        last="enemy";
      }
    }
  }
  return { player:p, enemy:e, lines, gauges:{player:barP, enemy:barE} };
}

export async function POST(req:Request){
  const body = await req.json().catch(()=> ({} as StepsBody));
  const battle_id = body.battle_id;
  const steps = Math.max(1, Number(body.steps ?? 1));
  if (!battle_id) return new NextResponse("battle_id obrigatório", { status: 400 });

  const supabase = await getSupabaseServer();
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Não autenticado", { status: 401 });

  const { data: bt, error: btErr } = await supabase
    .from("battles").select("*")
    .eq("id", battle_id).eq("user_id", user.id).maybeSingle();
  if (btErr) return new NextResponse(btErr.message, { status: 400 });
  if (!bt) return new NextResponse("Batalha não encontrada", { status: 404 });
  if (bt.status === "finished") return NextResponse.json({ battle: bt, lines: [] });

  const { player, enemy } = toStates(bt);
  const r = simulate(player, enemy, steps);

  const finished = r.player.hp<=0 || r.enemy.hp<=0;
  const winner = finished ? (r.player.hp>0 ? "player" : r.enemy.hp>0 ? "enemy" : "draw") : null;

  const newCursor = Number(bt.cursor ?? 0) + r.lines.length;
  const mergedLog = Array.isArray(bt.log) ? [...bt.log, ...r.lines] : r.lines;

  const { data: updated, error: updErr } = await supabase
    .from("battles")
    .update({
      cursor: newCursor,
      player_hp: r.player.hp,
      enemy_hp: r.enemy.hp,
      status: finished ? "finished":"active",
      winner: finished ? winner : bt.winner ?? null,
      log: mergedLog,
      gauges: r.gauges,
    })
    .eq("id", bt.id)
    .select("*")
    .maybeSingle();
  if (updErr) return new NextResponse(updErr.message, { status: 400 });

  return NextResponse.json({ battle: updated, lines: r.lines, gauges: r.gauges });
}
