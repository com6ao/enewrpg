// app/api/battle/act/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

/** ===== tipos ===== */
type Attrs = {
  str: number; dex: number; intt: number; wis: number;
  cha: number; con: number; luck: number;
};
type UnitState = {
  name: string;
  level: number;
  hp: number;
  hpMax: number;
  attrs: Attrs;
};
type CombatLine = {
  actor: "player" | "enemy";
  type: "action_complete";
  description: string;
  damage: number;
  damage_type: "hit" | "crit" | "miss";
  formula: {
    atk: number;
    def: number;
    base: number;
    mult: number;
    rand: number;
    crit: boolean;
  };
  target_hp_after: number;
  bar_player_before: number;
  bar_player_after: number;
  bar_enemy_before: number;
  bar_enemy_after: number;
};

type StepsBody = { battle_id?: string; steps?: number };

/** ===== util ===== */
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/** ===== atributos: leitura tolerante ===== */
function parseMaybeJSON<T>(v: any): T | null {
  if (v == null) return null;
  if (typeof v === "object") return v as T;
  if (typeof v === "string") {
    try { return JSON.parse(v) as T; } catch { return null; }
  }
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
function defaultAttrs(): Attrs {
  return { str: 5, dex: 5, intt: 5, wis: 5, cha: 5, con: 5, luck: 5 };
}
function extractAttrs(row: any, who: "player" | "enemy"): Attrs {
  const raw =
    row?.[`${who}_attrs`] ??
    row?.[`${who}_attributes`] ??
    row?.[`${who}Attrs`] ??
    row?.[`${who}Attributes`];
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

/** ===== regras ===== */
// Velocidade (ATB) = DEX + WIS
function speedOf(u: UnitState) {
  const { dex = 0, wis = 0 } = u.attrs ?? ({} as Attrs);
  // base pequena para evitar zero absoluto
  return 0.4 + dex * 0.05 + wis * 0.03;
}
// Sorte afeta crítico e miss
function rng(luck: number) {
  const base = Math.random();
  const luckBoost = clamp(luck, 0, 100) / 100;
  // mais sorte -> mais crítico, menos miss
  const crit = base > 0.9 - luckBoost * 0.2;
  const miss = base < 0.05 * (1 - luckBoost * 0.6);
  return { base, crit, miss };
}
// Dano = STR + INT, com pequena variação pelo nível
function doAttack(
  atk: UnitState,
  def: UnitState,
  who: "player" | "enemy",
  barPBefore: number,
  barEBefore: number
): { line: CombatLine; nextDefHP: number } {
  const { str = 1, intt = 0, luck = 0 } = atk.attrs ?? ({} as Attrs);
  const roll = rng(luck);
  if (roll.miss) {
    const missLine: CombatLine = {
      actor: who,
      type: "action_complete",
      description: `${atk.name} errou o ataque!`,
      damage: 0,
      damage_type: "miss",
      formula: { atk: str + intt, def: 0, base: 0, mult: 1, rand: roll.base, crit: false },
      target_hp_after: def.hp,
      bar_player_before: barPBefore,
      bar_player_after: who === "player" ? Math.max(0, barPBefore - 100) : barPBefore,
      bar_enemy_before: barEBefore,
      bar_enemy_after: who === "enemy" ? Math.max(0, barEBefore - 100) : barEBefore,
    };
    return { line: missLine, nextDefHP: def.hp };
  }

  const atkStat = str + intt;
  const baseDmg = Math.max(1, Math.floor(atkStat * 1.2 + (atk.level ?? 1) * 0.5));
  const spread = 0.8 + roll.base * 0.4;
  let dmg = Math.floor(baseDmg * spread);
  let kind: CombatLine["damage_type"] = "hit";
  if (roll.crit) {
    dmg = Math.floor(dmg * 1.6);
    kind = "crit";
  }

  const afterHP = clamp(def.hp - dmg, 0, def.hpMax);
  const line: CombatLine = {
    actor: who,
    type: "action_complete",
    description: `Dano: ${dmg} (${kind})`,
    damage: dmg,
    damage_type: kind,
    formula: { atk: atkStat, def: 0, base: baseDmg, mult: roll.crit ? 1.6 : 1, rand: spread, crit: roll.crit },
    target_hp_after: afterHP,
    bar_player_before: barPBefore,
    bar_player_after: who === "player" ? Math.max(0, barPBefore - 100) : barPBefore,
    bar_enemy_before: barEBefore,
    bar_enemy_after: who === "enemy" ? Math.max(0, barEBefore - 100) : barEBefore,
  };

  return { line, nextDefHP: afterHP };
}

/** ===== simulação N ações (ATB) ===== */
function simulateActions(
  player: UnitState,
  enemy: UnitState,
  maxActions: number
): { player: UnitState; enemy: UnitState; lines: CombatLine[] } {
  let p = { ...player }, e = { ...enemy };
  let gP = 0, gE = 0; // barras
  const sP = speedOf(p), sE = speedOf(e);
  const lines: CombatLine[] = [];

  while (lines.length < maxActions && p.hp > 0 && e.hp > 0) {
    // acumula até alguém ultrapassar 100
    while (gP < 100 && gE < 100) {
      gP += sP * 10; // aceleração para gerar ações visíveis
      gE += sE * 10;
    }

    if (gP >= gE) {
      // player age
      const { line, nextDefHP } = doAttack(p, e, "player", gP, gE);
      e = { ...e, hp: nextDefHP };
      lines.push(line);
      gP = Math.max(0, gP - 100);
    } else {
      // enemy age
      const { line, nextDefHP } = doAttack(e, p, "enemy", gP, gE);
      p = { ...p, hp: nextDefHP };
      lines.push(line);
      gE = Math.max(0, gE - 100);
    }
  }
  return { player: p, enemy: e, lines };
}

/** ===== handler ===== */
export async function POST(req: Request) {
  let body: StepsBody;
  try { body = await req.json(); } catch { return new NextResponse("payload inválido", { status: 400 }); }
  const battle_id = body.battle_id;
  const wantedSteps = Math.max(1, Number(body.steps ?? 1)); // número de AÇÕES
  if (!battle_id) return new NextResponse("battle_id obrigatório", { status: 400 });

  const supabase = await getSupabaseServer();
  const { data: userCtx } = await supabase.auth.getUser();
  if (!userCtx?.user) return new NextResponse("Não autenticado", { status: 401 });

  // carrega batalha do usuário
  const { data: bt, error: btErr } = await supabase
    .from("battles")
    .select("*")
    .eq("id", battle_id)
    .eq("user_id", userCtx.user.id)
    .maybeSingle();

  if (btErr) return new NextResponse(btErr.message, { status: 400 });
  if (!bt) return new NextResponse("Batalha não encontrada", { status: 404 });
  if (bt.status === "finished") return NextResponse.json({ battle: bt, lines: [] });

  // monta estados
  const { player, enemy } = rowToStates(bt);

  // simula
  const r = simulateActions(player, enemy, wantedSteps);
  const outLines = r.lines;

  // determina fim
  const finished = r.player.hp <= 0 || r.enemy.hp <= 0;
  const winner =
    finished && r.player.hp > 0 ? "player" :
    finished && r.enemy.hp > 0 ? "enemy" :
    finished ? "draw" : null;

  const newCursor = Number(bt.cursor ?? 0) + outLines.length;
  const mergedLog = Array.isArray(bt.log) ? [...bt.log, ...outLines] : outLines;

  // atualiza
  const { data: updated, error: updErr } = await supabase
    .from("battles")
    .update({
      cursor: newCursor,
      player_hp: r.player.hp,
      enemy_hp: r.enemy.hp,
      status: finished ? "finished" : "active",
      winner: finished ? winner : bt.winner ?? null,
      log: mergedLog,
    })
    .eq("id", bt.id)
    .select("*")
    .maybeSingle();

  if (updErr) return new NextResponse(updErr.message, { status: 400 });

  return NextResponse.json({ battle: updated, lines: outLines });
}
