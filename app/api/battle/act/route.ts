// app/api/battle/act/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer"; // TODO: ajuste o caminho se o seu helper tiver nome/local diferente
import { round, type UnitState } from "@/app/api/_core/combat"; // caminho do combat.ts que enviei

type StepsBody = { battle_id?: string; steps?: number };

/**
 * Converte os campos do row de `battles` nos UnitStates que o motor de combate usa.
 * Ajuste os nomes de campos caso seu schema seja diferente.
 */
function rowToStates(row: any): { player: UnitState; enemy: UnitState } {
  const player: UnitState = {
    name: row.player_name ?? "Você", // TODO se não houver, manter "Você"
    level: row.player_level ?? 1,    // opcional
    hp: row.player_hp,
    hpMax: row.player_hp_max,
    attrs: row.player_attrs,         // {str,dex,intt,wis,cha,con,luck}
  };
  const enemy: UnitState = {
    name: row.enemy_name,
    level: row.enemy_level ?? 1,     // opcional
    hp: row.enemy_hp,
    hpMax: row.enemy_hp_max,
    attrs: row.enemy_attrs,          // {str,dex,intt,wis,cha,con,luck}
  };
  return { player, enemy };
}

export async function POST(req: Request) {
  let body: StepsBody;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("payload inválido", { status: 400 });
  }

  const battle_id = body.battle_id;
  const wantedSteps = Math.max(1, Number(body.steps ?? 1));
  if (!battle_id) return new NextResponse("battle_id obrigatório", { status: 400 });

  const supabase = await getSupabaseServer();

  // Autenticação
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) return new NextResponse("Não autenticado", { status: 401 });

  // Carrega a batalha do usuário
  const { data: bt, error: btErr } = await supabase
    .from("battles") // TODO ajuste se o nome for outro
    .select("*")
    .eq("id", battle_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (btErr) return new NextResponse(btErr.message, { status: 400 });
  if (!bt) return new NextResponse("Batalha não encontrada", { status: 404 });

  if (bt.status === "finished") {
    // Nada a fazer; retornamos sem alterar
    return NextResponse.json({ battle: bt, lines: [] });
  }

  // Constrói estados atuais
  let { player, enemy } = rowToStates(bt);

  // Segurança: attrs presentes?
  if (!player.attrs || !enemy.attrs) {
    return new NextResponse("Atributos ausentes na batalha", { status: 400 });
  }

  const outLines: any[] = [];
  let turnsDone = 0;

  while (turnsDone < wantedSteps && player.hp > 0 && enemy.hp > 0) {
    const r = round(player, enemy);

    // r.lines tem até 2 linhas (player -> enemy; e, se inimigo vivo, enemy -> player)
    // acrescentamos meta "source" para colorir no front
    r.lines.forEach((ln, idx) => {
      outLines.push({
        ...ln,
        source: idx === 0 ? "player" : "enemy", // 0: player ataca; 1: enemy revida (se houver)
      });
    });

    player = r.player;
    enemy = r.enemy;

    turnsDone++;
  }

  // Determina status/winner
  const finished = player.hp <= 0 || enemy.hp <= 0;
  const winner =
    finished && player.hp > 0
      ? "player"
      : finished && enemy.hp > 0
      ? "enemy"
      : finished
      ? "draw"
      : null;

  // Atualiza batalha
  const newCursor = Number(bt.cursor ?? 0) + turnsDone;

  const { data: updated, error: updErr } = await supabase
    .from("battles") // TODO ajuste se o nome for outro
    .update({
      cursor: newCursor,
      player_hp: player.hp,
      enemy_hp: enemy.hp,
      status: finished ? "finished" : "active",
      winner: finished ? winner : bt.winner ?? null,
      // Se você persiste o log num array na tabela, aqui você poderia fazer um merge.
      // Ex.: log: [...(bt.log ?? []), ...outLines],
    })
    .eq("id", bt.id)
    .select("*")
    .maybeSingle();

  if (updErr) return new NextResponse(updErr.message, { status: 400 });

  return NextResponse.json({
    battle: updated,
    lines: outLines,
  });
}
