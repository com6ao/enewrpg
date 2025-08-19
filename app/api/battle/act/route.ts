import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { toEvent, applyEvent } from "@/lib/battleServer";
import type { BattleLogEntry } from "@/lib/combat";

export async function POST(req: Request) {
  const { battle_id, steps = 1 } = await req.json?.() ?? {};
  if (!battle_id) return new NextResponse("battle_id obrigatório", { status: 400 });

  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Não autenticado", { status: 401 });

  // carrega batalha do usuário
  const { data: bt } = await supabase
    .from("battles")
    .select("*")
    .eq("id", battle_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!bt) return new NextResponse("Batalha não encontrada", { status: 404 });
  if (bt.status === "finished") return NextResponse.json({ battle: bt, lines: [] });

  // estado atual
  const log: BattleLogEntry[] = Array.isArray(bt.log) ? bt.log : [];
  const start = bt.cursor ?? 0;
  const end = Math.min(start + Number(steps), log.length);

  // aplica eventos do intervalo [start, end)
  const state = { player_hp: bt.player_hp, enemy_hp: bt.enemy_hp };
  const linesAdded: string[] = [];

  for (let i = start; i < end; i++) {
    const line = log[i];
    const ev = toEvent(line?.description ?? line);   // aceita string/obj
    if (ev) applyEvent(state, ev);
    linesAdded.push(typeof line === "string" ? line : line.description);
  }

  // terminou?
  let finished = false;
  let winner: "player" | "enemy" | "draw" | null = null;
  if (state.player_hp <= 0 && state.enemy_hp <= 0) { finished = true; winner = "draw"; }
  else if (state.enemy_hp <= 0) { finished = true; winner = "player"; }
  else if (state.player_hp <= 0) { finished = true; winner = "enemy"; }

  const { data: updated, error } = await supabase
    .from("battles")
    .update({
      cursor: end,
      player_hp: state.player_hp,
      enemy_hp: state.enemy_hp,
      status: finished ? "finished" : "active",
      winner: finished ? winner : null
    })
    .eq("id", bt.id)
    .select()
    .maybeSingle();

  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json({ battle: updated, lines: linesAdded });
}
