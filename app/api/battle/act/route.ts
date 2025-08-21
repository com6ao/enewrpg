// app/api/battle/act/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

// ==== motor de combate inline ====
type Attrs = { str: number; dex: number; intt: number; wis: number; cha: number; con: number; luck: number; };
type UnitState = { name: string; level: number; hp: number; hpMax: number; attrs: Attrs; };
type CombatLine = { text: string; dmg: number; from: "player" | "enemy"; to: "player" | "enemy"; kind: "hit" | "crit" | "miss"; };

function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }
function rng(luck: number) {
  const base = Math.random();
  const luckBoost = clamp(luck, 0, 100) / 100;
  return { base, crit: base > 0.9 - luckBoost * 0.2, miss: base < 0.05 * (1 - luckBoost * 0.6) };
}
function attack(atk: UnitState, def: UnitState, from: "player" | "enemy", to: "player" | "enemy"): CombatLine {
  const { str, luck } = atk.attrs;
  const roll = rng(luck ?? 0);
  if (roll.miss) return { text: `${atk.name} errou o ataque!`, dmg: 0, from, to, kind: "miss" };
  const baseDmg = Math.max(1, Math.floor((str ?? 1) * 1.5 + (atk.level ?? 1) * 0.5));
  const spread = 0.8 + roll.base * 0.4;
  let dmg = Math.floor(baseDmg * spread);
  let kind: CombatLine["kind"] = "hit";
  if (roll.crit) { dmg = Math.floor(dmg * 1.6); kind = "crit"; }
  return { text: `${atk.name} causou ${dmg} de dano.`, dmg, from, to, kind };
}
function round(player: UnitState, enemy: UnitState) {
  const lines: CombatLine[] = [];
  const l1 = attack(player, enemy, "player", "enemy");
  let enemyHp = clamp(enemy.hp - l1.dmg, 0, enemy.hpMax);
  lines.push(l1);
  if (enemyHp > 0) {
    const l2 = attack(enemy, player, "enemy", "player");
    const playerHp = clamp(player.hp - l2.dmg, 0, player.hpMax);
    lines.push(l2);
    return { player: { ...player, hp: playerHp }, enemy: { ...enemy, hp: enemyHp }, lines };
  }
  return { player, enemy: { ...enemy, hp: enemyHp }, lines };
}
// =================================

// helpers de robustez
function parseMaybeJSON<T>(v: any): T | null {
  if (v == null) return null;
  if (typeof v === "object") return v as T;
  if (typeof v === "string") {
    try { return JSON.parse(v) as T; } catch { return null; }
  }
  return null;
}
function pickFirst<T = any>(row: any, keys: string[]): T | null {
  for (const k of keys) if (row && row[k] != null) return row[k] as T;
  return null;
}
function fallbackAttrsFromColumns(row: any, prefix: "player" | "enemy"): Attrs | null {
  const get = (k: string) => Number(row?.[`${prefix}_${k}`]);
  const str = get("str"), dex = get("dex"), intt = get("intt"), wis = get("wis"), cha = get("cha"), con = get("con"), luck = get("luck");
  if ([str, dex, intt, wis, cha, con, luck].every((n) => !Number.isNaN(n))) {
    return { str, dex, intt, wis, cha, con, luck };
  }
  return null;
}
function defaultAttrs(): Attrs { return { str: 5, dex: 5, intt: 5, wis: 5, cha: 5, con: 5, luck: 5 }; }

function extractAttrs(row: any, who: "player" | "enemy"): { attrs: Attrs; usedDefault: boolean } {
  // tenta vários nomes comuns e também string JSON
  const raw =
    pickFirst<any>(row, [`${who}_attrs`, `${who}_attributes`, `${who}Attrs`, `${who}Attributes`]) ??
    null;
  const parsed = parseMaybeJSON<Attrs>(raw);
  if (parsed) return { attrs: parsed, usedDefault: false };

  const fromCols = fallbackAttrsFromColumns(row, who);
  if (fromCols) return { attrs: fromCols, usedDefault: false };

  return { attrs: defaultAttrs(), usedDefault: true };
}

type StepsBody = { battle_id?: string; steps?: number };

function rowToStates(row: any): { player: UnitState; enemy: UnitState; warnings: string[] } {
  const warnings: string[] = [];
  const p = extractAttrs(row, "player");
  const e = extractAttrs(row, "enemy");
  if (p.usedDefault) warnings.push("player_attrs ausentes, usando padrão");
  if (e.usedDefault) warnings.push("enemy_attrs ausentes, usando padrão");

  const player: UnitState = {
    name: row.player_name ?? "Você",
    level: Number(row.player_level ?? 1),
    hp: Number(row.player_hp ?? 0),
    hpMax: Number(row.player_hp_max ?? row.player_hp ?? 1),
    attrs: p.attrs,
  };
  const enemy: UnitState = {
    name: row.enemy_name ?? "Inimigo",
    level: Number(row.enemy_level ?? 1),
    hp: Number(row.enemy_hp ?? 0),
    hpMax: Number(row.enemy_hp_max ?? row.enemy_hp ?? 1),
    attrs: e.attrs,
  };
  return { player, enemy, warnings };
}

export async function POST(req: Request) {
  let body: StepsBody;
  try { body = await req.json(); } catch { return new NextResponse("payload inválido", { status: 400 }); }

  const battle_id = body.battle_id;
  const wantedSteps = Math.max(1, Number(body.steps ?? 1));
  if (!battle_id) return new NextResponse("battle_id obrigatório", { status: 400 });

  const supabase = await getSupabaseServer();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return new NextResponse("Não autenticado", { status: 401 });

  const { data: bt, error: btErr } = await supabase
    .from("battles")
    .select("*")
    .eq("id", battle_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (btErr) return new NextResponse(btErr.message, { status: 400 });
  if (!bt) return new NextResponse("Batalha não encontrada", { status: 404 });
  if (bt.status === "finished") return NextResponse.json({ battle: bt, lines: [], warnings: [] });

  let { player, enemy, warnings } = rowToStates(bt);

  const outLines: any[] = [];
  let turnsDone = 0;

  while (turnsDone < wantedSteps && player.hp > 0 && enemy.hp > 0) {
    const r = round(player, enemy);
    r.lines.forEach((ln, idx) => outLines.push({ ...ln, source: idx === 0 ? "player" : "enemy" }));
    player = r.player;
    enemy = r.enemy;
    turnsDone++;
  }

  const finished = player.hp <= 0 || enemy.hp <= 0;
  const winner =
    finished && player.hp > 0 ? "player" :
    finished && enemy.hp > 0 ? "enemy" :
    finished ? "draw" : null;

  const newCursor = Number(bt.cursor ?? 0) + turnsDone;

  const { data: updated, error: updErr } = await supabase
    .from("battles")
    .update({
      cursor: newCursor,
      player_hp: player.hp,
      enemy_hp: enemy.hp,
      status: finished ? "finished" : "active",
      winner: finished ? winner : bt.winner ?? null,
      // Se existir coluna log e quiser registrar:
      // log: [...(bt.log ?? []), ...outLines],
    })
    .eq("id", bt.id)
    .select("*")
    .maybeSingle();

  if (updErr) return new NextResponse(updErr.message, { status: 400 });

  return NextResponse.json({ battle: updated, lines: outLines, warnings });
}
