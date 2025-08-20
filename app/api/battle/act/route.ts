// app/api/battle/act/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

// ==== Combat engine inline (sem novos arquivos) ====
type Attrs = {
  str: number; dex: number; intt: number; wis: number; cha: number; con: number; luck: number;
};
export type UnitState = {
  name: string;
  level: number;
  hp: number;
  hpMax: number;
  attrs: Attrs;
};

type CombatLine = {
  text: string;
  dmg: number;
  from: "player" | "enemy";
  to: "player" | "enemy";
  kind: "hit" | "crit" | "miss";
};

function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }
function rng(luck: number) {
  // luck 0–100: reduz variância e aumenta chance de crítico
  const base = Math.random();
  const luckBoost = clamp(luck, 0, 100) / 100;
  return { base, crit: base > 0.9 - luckBoost * 0.2, miss: base < 0.05 * (1 - luckBoost * 0.6) };
}
function attack(atk: UnitState, def: UnitState, from: "player" | "enemy", to: "player" | "enemy"): CombatLine {
  const { str, luck } = atk.attrs;
  const roll = rng(luck ?? 0);
  if (roll.miss) {
    return { text: `${atk.name} errou o ataque!`, dmg: 0, from, to, kind: "miss" };
  }
  const baseDmg = Math.max(1, Math.floor((str ?? 1) * 1.5 + (atk.level ?? 1) * 0.5));
  const spread = 0.8 + roll.base * 0.4; // 0.8–1.2
  let dmg = Math.floor(baseDmg * spread);
  let kind: CombatLine["kind"] = "hit";
  if (roll.crit) {
    dmg = Math.floor(dmg * 1.6);
    kind = "crit";
  }
  return { text: `${atk.name} causou ${dmg} de dano.`, dmg, from, to, kind };
}

function round(player: UnitState, enemy: UnitState): { player: UnitState; enemy: UnitState; lines: CombatLine[] } {
  const lines: CombatLine[] = [];

  // Player ataca
  let l1 = attack(player, enemy, "player", "enemy");
  let enemyHp = clamp(enemy.hp - l1.dmg, 0, enemy.hpMax);
  lines.push(l1);

  // Se inimigo ainda vive, revida
  if (enemyHp > 0) {
    const l2 = attack(enemy, player, "enemy", "player");
    const playerHp = clamp(player.hp - l2.dmg, 0, player.hpMax);
    lines.push(l2);
    return { player: { ...player, hp: playerHp }, enemy: { ...enemy, hp: enemyHp }, lines };
  }

  return { player, enemy: { ...enemy, hp: enemyHp }, lines };
}
// ===================================================

type StepsBody = { battle_id?: string; steps?: number };

function rowToStates(row: any): { player: UnitState; enemy: UnitState } {
  const player: UnitState = {
    name: row.player_name ?? "Você",
    level: row.player_level ?? 1,
    hp: Number(row.player_hp ?? 0),
    hpMax: Number(row.player_hp_max ?? row.player_hp ?? 1),
    attrs: row.player_attrs as Attrs,
  };
  const enemy: UnitState = {
    name: row.enemy_name ?? "Inimigo",
    level: row.enemy_level ?? 1,
    hp: Number(row.enemy_hp ?? 0),
    hpMax: Number(row.enemy_hp_max ?? row.enemy_hp ?? 1),
    attrs: row.enemy_attrs as Attrs,
  };
  return { player, enemy };
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

  if (bt.status === "finished") {
    return NextResponse.json({ battle: bt, lines: [] });
  }

  let { player, enemy } = rowToStates(bt);
  if (!player.attrs || !enemy.attrs) return new NextResponse("Atributos ausentes na batalha", { status: 400 });

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
      // Opcional: persista o log se sua tabela tiver a coluna
      // log: [...(bt.log ?? []), ...outLines],
    })
    .eq("id", bt.id)
    .select("*")
    .maybeSingle();

  if (updErr) return new NextResponse(updErr.message, { status: 400 });

  return NextResponse.json({ battle: updated, lines: outLines });
}
