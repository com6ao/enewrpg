// app/api/battle/act/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

/** ===== TIPOS ===== */
type Attrs = { str: number; dex: number; intt: number; wis: number; cha: number; con: number; luck: number };
type UnitState = { name: string; level: number; hp: number; hpMax: number; attrs: Attrs };

type UILog = {
  actor: "player" | "enemy";
  type: "action_complete";
  description: string;
  damage: number;
  damage_type: "hit" | "crit" | "miss";
  formula: string;
  target_hp_after: number;
  bar_player_before: number;
  bar_player_after: number;
  bar_enemy_before: number;
  bar_enemy_after: number;
};

type StepsBody = { battle_id?: string; steps?: number };

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/** ===== helpers para ler attrs de forma tolerante ===== */
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
  const vals = ["str", "dex", "intt", "wis", "cha", "con", "luck"].map(get);
  if (vals.every((n) => Number.isFinite(n))) {
    const [str, dex, intt, wis, cha, con, luck] = vals;
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

/** ===== fórmulas ===== */
// velocidade baseada em DEX + WIS
function speedOf(u: UnitState) {
  const { dex = 0, wis = 0 } = u.attrs ?? ({} as Attrs);
  return 0.4 + dex * 0.05 + wis * 0.03;
}
function rng(luck: number) {
  const base = Math.random();
  const luckBoost = clamp(luck, 0, 100) / 100;
  return { base, crit: base > 0.9 - luckBoost * 0.2, miss: base < 0.05 * (1 - luckBoost * 0.6) };
}
// dano com STR + INT
function attemptAttack(atk: UnitState) {
  const { str = 0, intt = 0, luck = 0 } = atk.attrs ?? ({} as Attrs);
  const roll = rng(luck);
  const miss = roll.miss;
  const base = Math.max(1, Math.floor((str + intt) * 1.2 + (atk.level ?? 1) * 0.5));
  const spread = 0.8 + roll.base * 0.4;
  const crit = roll.crit && !miss;
  const mult = crit ? 1.6 : 1.0;
  const damage = miss ? 0 : Math.floor(base * spread * mult);
  const kind: "hit" | "crit" | "miss" = miss ? "miss" : crit ? "crit" : "hit";
  const formula = miss ? "miss" : `${base} * ${spread.toFixed(2)}${crit ? " * 1.6" : ""}`;
  const desc = `Dano: ${damage} (${kind})`;
  return { damage, kind, desc, formula };
}

/** ===== simulador ATB com empate alternado + telemetria das barras ===== */
function simulateActions(player: UnitState, enemy: UnitState, maxActions: number) {
  let p = { ...player }, e = { ...enemy };
  let barP = 0, barE = 0; // 0..100
  const spdP = speedOf(p) * 100;
  const spdE = speedOf(e) * 100;
  const lines: UILog[] = [];
  let lastActor: "player" | "enemy" = "enemy";

  while (lines.length < maxActions && p.hp > 0 && e.hp > 0) {
    const needP = Math.max(0, 100 - barP);
    const needE = Math.max(0, 100 - barE);
    const dt = Math.min(needP / spdP, needE / spdE);
    barP += spdP * dt;
    barE += spdE * dt;

    while ((barP >= 100 || barE >= 100) && lines.length < maxActions && p.hp > 0 && e.hp > 0) {
      const actor: "player" | "enemy" =
        barP > barE ? "player" :
        barE > barP ? "enemy"  :
        (lastActor === "enemy" ? "player" : "enemy");

      if (actor === "player") {
        const beforeP = Math.min(100, barP), beforeE = Math.min(100, barE);
        barP -= 100;
        const r = attemptAttack(p);
        e = { ...e, hp: clamp(e.hp - r.damage, 0, e.hpMax) };
        lines.push({
          actor: "player",
          type: "action_complete",
          description: r.desc.replace("TARGET", e.name).replace("YOU", "Você"),
          damage: r.damage,
          damage_type: r.kind,
          formula: r.formula,
          target_hp_after: e.hp,
          bar_player_before: beforeP,
          bar_player_after: Math.max(0, barP),
          bar_enemy_before: beforeE,
          bar_enemy_after: barE,
        });
        lastActor = "player";
      } else {
        const beforeP = Math.min(100, barP), beforeE = Math.min(100, barE);
        barE -= 100;
        const r = attemptAttack(e);
        p = { ...p, hp: clamp(p.hp - r.damage, 0, p.hpMax) };
        lines.push({
          actor: "enemy",
          type: "action_complete",
          description: r.desc.replace("YOU", e.name).replace("TARGET", "Você"),
          damage: r.damage,
          damage_type: r.kind,
          formula: r.formula,
          target_hp_after: p.hp,
          bar_player_before: beforeP,
          bar_player_after: barP,
          bar_enemy_before: beforeE,
          bar_enemy_after: Math.max(0, barE),
        });
        lastActor = "enemy";
      }
    }
  }
  return { player: p, enemy: e, lines, gauges: { player: barP, enemy: barE } };
}

/** ===== handler ===== */
export async function POST(req: Request) {
  let body: StepsBody;
  try { body = await req.json(); } catch { return new NextResponse("payload inválido", { status: 400 }); }

  const battle_id = body.battle_id;
  const wantedSteps = Math.max(1, Number(body.steps ?? 1));
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

  const { player, enemy } = rowToStates(bt);
  const r = simulateActions(player, enemy, wantedSteps);

  const finished = r.player.hp <= 0 || r.enemy.hp <= 0;
  const winner =
    finished && r.player.hp > 0 ? "player" :
    finished && r.enemy.hp > 0 ? "enemy" :
    finished ? "draw" : null;

  const newCursor = Number(bt.cursor ?? 0) + r.lines.length;
  const mergedLog = Array.isArray(bt.log) ? [...bt.log, ...r.lines] : r.lines;

  const { data: updated, error: updErr } = await supabase
    .from("battles")
    .update({
      cursor: newCursor,
      player_hp: r.player.hp,
      enemy_hp: r.enemy.hp,
      status: finished ? "finished" : "active",
      winner: finished ? winner : bt.winner ?? null,
      log: mergedLog,
      gauges: r.gauges, // jsonb (crie com: alter table public.battles add column if not exists gauges jsonb default '{}'::jsonb not null;)
    })
    .eq("id", bt.id)
    .select("*")
    .maybeSingle();

  if (updErr) return new NextResponse(updErr.message, { status: 400 });

  return NextResponse.json({ battle: updated, lines: r.lines, gauges: r.gauges });
}
