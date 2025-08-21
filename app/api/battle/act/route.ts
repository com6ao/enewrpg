import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

// ====== tipos ======
type Attrs = { str: number; dex: number; intt: number; wis: number; cha: number; con: number; luck: number; };
type UnitState = { name: string; level: number; hp: number; hpMax: number; attrs: Attrs; };
type CombatLine = { text: string; dmg: number; from: "player" | "enemy"; to: "player" | "enemy"; kind: "hit" | "crit" | "miss"; source?: "player" | "enemy" };

type StepsBody = { battle_id?: string; steps?: number };

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

// ====== util atributos robusto ======
function parseMaybeJSON<T>(v: any): T | null {
  if (v == null) return null;
  if (typeof v === "object") return v as T;
  if (typeof v === "string") { try { return JSON.parse(v) as T; } catch { return null; } }
  return null;
}
function pickFirst<T = any>(row: any, keys: string[]): T | null {
  for (const k of keys) if (row && row[k] != null) return row[k] as T;
  return null;
}
function fallbackAttrsFromColumns(row: any, prefix: "player" | "enemy"): Attrs | null {
  const get = (k: string) => Number(row?.[`${prefix}_${k}`]);
  const v = ["str","dex","intt","wis","cha","con","luck"].map(get);
  if (v.every((n) => Number.isFinite(n))) {
    const [str,dex,intt,wis,cha,con,luck] = v;
    return { str, dex, intt, wis, cha, con, luck };
  }
  return null;
}
function defaultAttrs(): Attrs { return { str: 5, dex: 5, intt: 5, wis: 5, cha: 5, con: 5, luck: 5 }; }
function extractAttrs(row: any, who: "player" | "enemy"): Attrs {
  const raw = pickFirst<any>(row, [`${who}_attrs`, `${who}_attributes`, `${who}Attrs`, `${who}Attributes`]);
  return parseMaybeJSON<Attrs>(raw) ?? fallbackAttrsFromColumns(row, who) ?? defaultAttrs();
}

function rowToStates(row: any): { player: UnitState; enemy: UnitState } {
  const player: UnitState = {
    name: row.player_name ?? "Você",
    level: Number(row.player_level ?? 1),
    hp: Number(row.player_hp ?? 0),
    hpMax: Number(row.player_hp_max ?? row.player_hp ?? 1),
    attrs: extractAttrs(row, "player"),
  };
  const enemy: UnitState = {
    name: row.enemy_name ?? "Inimigo",
    level: Number(row.enemy_level ?? 1),
    hp: Number(row.enemy_hp ?? 0),
    hpMax: Number(row.enemy_hp_max ?? row.enemy_hp ?? 1),
    attrs: extractAttrs(row, "enemy"),
  };
  return { player, enemy };
}

// ====== ATB: barra de ação por velocidade ======
// velocidade base: escala com DEX e um pouco com LUCK
function speedOf(u: UnitState) {
  const { dex = 0, wis = 0 } = u.attrs ?? ({} as Attrs);
  // retorna progresso por "tick"
  return 0.2 + dex * 0.02 + wis * 0.02; // ~0.4..>2.0
}
function rng(luck: number) {
  const base = Math.random();
  const luckBoost = clamp(luck, 0, 100) / 100;
  return { base, crit: base > 0.9 - luckBoost * 0.2, miss: base < 0.05 * (1 - luckBoost * 0.6) };
}
function doAttack(atk: UnitState, def: UnitState, from: "player" | "enemy", to: "player" | "enemy"): CombatLine {
  const { str = 1, intt = 0, luck = 0 } = atk.attrs ?? ({} as Attrs);
  const roll = rng(luck);
  if (roll.miss) return { text: `${atk.name} errou o ataque!`, dmg: 0, from, to, kind: "miss" };
  const baseDmg = Math.max(1, Math.floor((str + intt) * 1.2 + (atk.level ?? 1) * 0.5));
  const spread = 0.8 + roll.base * 0.4; // 0.8–1.2
  let dmg = Math.floor(baseDmg * spread);
  let kind: CombatLine["kind"] = "hit";
  if (roll.crit) { dmg = Math.floor(dmg * 1.6); kind = "crit"; }
  return { text: `Dano: ${dmg} (${kind})`, dmg, from, to, kind };
}

// produz até N ações (não “turnos” fixos). O mais rápido pode agir várias vezes.
function simulateActions(player: UnitState, enemy: UnitState, maxActions: number) {
  let p = { ...player }, e = { ...enemy };
  let gP = 0, gE = 0; // gauges
  const sP = speedOf(p), sE = speedOf(e);
  const lines: CombatLine[] = [];

  while (lines.length < maxActions && p.hp > 0 && e.hp > 0) {
    // preenche barras até alguém ultrapassar 1.0
    while (gP < 1 && gE < 1) { gP += sP; gE += sE; }
    if (gP >= gE) {
      // player age
      const ln = doAttack(p, e, "player", "enemy"); ln.source = "player";
      e = { ...e, hp: clamp(e.hp - ln.dmg, 0, e.hpMax) };
      lines.push(ln);
      gP -= 1;
    } else {
      // enemy age
      const ln = doAttack(e, p, "enemy", "player"); ln.source = "enemy";
      p = { ...p, hp: clamp(p.hp - ln.dmg, 0, p.hpMax) };
      lines.push(ln);
      gE -= 1;
    }
  }
  return { player: p, enemy: e, lines };
}

// ====== handler ======
export async function POST(req: Request) {
  let body: StepsBody;
  try { body = await req.json(); } catch { return new NextResponse("payload inválido", { status: 400 }); }
  const battle_id = body.battle_id;
  const wantedSteps = Math.max(1, Number(body.steps ?? 1)); // interpreta como número de AÇÕES reveladas
  if (!battle_id) return new NextResponse("battle_id obrigatório", { status: 400 });

  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Não autenticado", { status: 401 });

  const { data: bt, error: btErr } = await supabase
    .from("battles")
    .select("*")
    .eq("id", battle_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (btErr) return new NextResponse(btErr.message, { status: 400 });
  if (!bt) return new NextResponse("Batalha não encontrada", { status: 404 });
  if (bt.status === "finished") return NextResponse.json({ battle: bt, lines: [] });

  let { player, enemy } = rowToStates(bt);

  // simula AÇÕES, não turnos
  const r = simulateActions(player, enemy, wantedSteps);
  const outLines = r.lines;

  const finished = r.player.hp <= 0 || r.enemy.hp <= 0;
  const winner =
    finished && r.player.hp > 0 ? "player" :
    finished && r.enemy.hp > 0 ? "enemy" :
    finished ? "draw" : null;

  const newCursor = Number(bt.cursor ?? 0) + outLines.length;

  // >>> CORREÇÃO: persistir log para a coluna direita ler <<<
  const mergedLog = Array.isArray(bt.log) ? [...bt.log, ...outLines] : outLines;

  const { data: updated, error: updErr } = await supabase
    .from("battles")
    .update({
      cursor: newCursor,
      player_hp: r.player.hp,
      enemy_hp: r.enemy.hp,
      status: finished ? "finished" : "active",
      winner: finished ? winner : bt.winner ?? null,
      log: mergedLog, // agora o front pode usar battle.log
    })
    .eq("id", bt.id)
    .select("*")
    .maybeSingle();

  if (updErr) return new NextResponse(updErr.message, { status: 400 });

  // retorna lines e battle com log atualizado
  return NextResponse.json({ battle: updated, lines: outLines });
}
