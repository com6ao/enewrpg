import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { toEvent, applyEvent } from "@/lib/battleServer";

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
    return NextResponse.json({ battle: bt, lines: [] });
  }

  const log: any[] = Array.isArray(bt.log) ? bt.log : [];
  const start = bt.cursor;
  const end = Math.min(start + Number(steps), log.length);

  const lines: any[] = [];
  const state = { player_hp: bt.player_hp, enemy_hp: bt.enemy_hp };

  for (let i = start; i < end; i++) {
    const line = log[i];
    lines.push(line);                 // devolvemos o objeto original
    const ev = toEvent(line);         // converte para evento simples
    if (ev) applyEvent(state, ev);    // atualiza HPs
  }

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
    .select("*").single();

  if (error) return new NextResponse(error.message, { status: 400 });

  return NextResponse.json({ battle: updated, lines });
}
