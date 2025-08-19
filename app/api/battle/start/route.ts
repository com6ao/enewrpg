// app/api/battle/start/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { resolveCombat, Attrs } from "@/lib/combat";
import { scaleEnemy } from "@/lib/formulas";

export async function POST(req: Request) {
  const { area, tier = 1 } = await req.json();
  if (!area) return new NextResponse("Informe a área", { status: 400 });

  const supabase = await getSupabaseServer();

  // usuário
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Não autenticado", { status: 401 });

  // personagem ativo
  const { data: profile } = await supabase
    .from("profiles")
    .select("active_character_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.active_character_id) {
    return new NextResponse("Nenhum personagem ativo", { status: 400 });
  }

  const { data: char } = await supabase
    .from("characters")
    .select("*")
    .eq("id", profile.active_character_id)
    .maybeSingle();

  if (!char) return new NextResponse("Personagem não encontrado", { status: 400 });

  // inimigos da área
  const { data: enemies } = await supabase
    .from("enemies")
    .select("*")
    .eq("category", area);

  if (!enemies?.length)
    return new NextResponse("Nenhum inimigo para esta área", { status: 400 });

  const baseEnemy = enemies[Math.floor(Math.random() * enemies.length)];

  // monta Attrs
  const playerAttrs: Attrs = {
    level: char.level,
    str: char.str, dex: char.dex, intt: char.intt,
    wis: char.wis, cha: char.cha, con: char.con, luck: char.luck,
  };

  const enemyBaseAttrs: Attrs = {
    level: baseEnemy.level,
    str: baseEnemy.str, dex: baseEnemy.dex, intt: baseEnemy.intt,
    wis: baseEnemy.wis, cha: baseEnemy.cha, con: baseEnemy.con, luck: baseEnemy.luck,
  };

  // escala por TIER
  const enemyScaled = scaleEnemy(enemyBaseAttrs, Number(tier) || 1);

  // resolve
  const outcome = await resolveCombat(playerAttrs, { ...enemyScaled, name: baseEnemy.name });

  // salva batalha
  const { data: inserted, error } = await supabase
    .from("battles")
    .insert({
      user_id: user.id,
      character_id: char.id,
      area,
      enemy_id: baseEnemy.id,
      enemy_name: baseEnemy.name,
      player_hp: outcome.log.find(l => l.actor === "player") ? outcome.log.filter(l => l.actor === "enemy").slice(-1)[0]?.target_hp_after ?? 0 : 0, // opcional
      enemy_hp:  outcome.log.slice(-1)[0]?.target_hp_after ?? 0,
      player_hp_max: 30 + char.level * 5 + char.con * 1,
      enemy_hp_max:  30 + enemyScaled.level * 5 + enemyScaled.con * 1,
      cursor: outcome.log.length,
      status: "finished",
      winner: outcome.result === "win" ? "player" : "enemy",
      log: outcome.log,          // jsonb[]
      created_at: new Date().toISOString(),
    })
    .select("*")
    .maybeSingle();

  if (error) return new NextResponse(error.message, { status: 400 });

  return NextResponse.json({
    battle: inserted,
    player_attrs: playerAttrs,
    enemy_attrs: { ...enemyScaled, name: baseEnemy.name },
  });
}
