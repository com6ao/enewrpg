// app/api/battle/act/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { applyEvent, toEvent } from "@/lib/battleServer";

export async function POST(req: Request) {
  const { battle_id, steps = 1 } = await req.json();
  if (!battle_id) return new NextResponse("battle_id obrigatório", { status: 400 });

  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Não autenticado", { status: 401 });

  const { data: bt } = await supabase
    .from("battles")
    .select("*")
    .eq("id", battle_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!bt) return new NextResponse("Batalha não encontrada", { status: 404 });

  if (bt.status === "finished") {
    return NextResponse.json({
      battle: {
        id: bt.id, enemy_name: bt.enemy_name,
        player_hp: bt.player_hp, player_hp_max: bt.player_hp_max,
        enemy_hp: bt.enemy_hp, enemy_hp_max: bt.enemy_hp_max,
        cursor: bt.cursor, status: bt.status, winner: bt.winner,
      },
      lines: [],
    });
  }

  const log: any[] = Array.isArray(bt.log) ? bt.log : [];
  const start = bt.cursor;
  const end = Math.min(start + Math.max(1, Number(steps)), log.length);

  const shown: string[] = [];
  let player_hp = bt.player_hp;
  let enemy_hp = bt.enemy_hp;

  for (let i = start; i < end; i++) {
    const line = log[i];
    shown.push(typeof line === "string" ? line : (line?.text ?? JSON.stringify(line)));
    const ev = toEvent(line);
    if (ev) applyEvent({ player_hp, enemy_hp } as any, ev);
    // applyEvent muta, então recupere
    player_hp = (applyEvent as any).last_player_hp ?? player_hp; // não precisamos disso se usarmos objeto
  }

  // fim seguro
  const state = { player_hp, enemy_hp };
  const finished = end >= log.length || state.player_hp <= 0 || state.enemy_hp <= 0;
  const winner =
    finished
      ? state.player_hp <= 0 && state.enemy_hp <= 0
        ? "draw"
        : state.player_hp > 0
          ? "player"
          : "enemy"
      : null;

  const { data: updated, error } = await supabase
    .from("battles")
    .update({
      cursor: end,
      player_hp: state.player_hp,
      enemy_hp: state.enemy_hp,
      status: finished ? "finished" : "active",
      winner,
    })
    .eq("id", bt.id)
    .select("id, enemy_name, player_hp, player_hp_max, enemy_hp, enemy_hp_max, cursor, status, winner")
    .single();

  if (error) return new NextResponse(error.message, { status: 400 });

  return NextResponse.json({ battle: updated, lines: shown });
}
