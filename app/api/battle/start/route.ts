// app/api/battle/start/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { resolveCombatFromHP, type Attrs } from "@/lib/combat";
// (se quiser usar tiers depois, pode importar scaleEnemy de lib/formulas)

export async function POST(req: Request) {
  const { area } = await req.json();
  if (!area) return new NextResponse("Informe a área", { status: 400 });

  const supabase = await getSupabaseServer();

  // usuário
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Não autenticado", { status: 401 });

  // personagem ativo
  const { data: profile } = await supabase
    .from("profiles").select("active_character_id").eq("id", user.id).maybeSingle();
  if (!profile?.active_character_id)
    return new NextResponse("Nenhum personagem ativo", { status: 400 });

  const { data: char } = await supabase
    .from("characters").select("*").eq("id", profile.active_character_id).maybeSingle();
  if (!char) return new NextResponse("Personagem não encontrado", { status: 400 });

  // inimigo
  const { data: enemies } = await supabase
    .from("enemies").select("*").eq("category", area);
  if (!enemies?.length)
    return new NextResponse("Nenhum inimigo para esta área", { status: 400 });
  const enemy = enemies[Math.floor(Math.random() * enemies.length)];

  // monta Attrs
  const playerAttrs: Attrs = {
    level: char.level, str: char.str, dex: char.dex, intt: char.intt, wis: char.wis,
    cha: char.cha, con: char.con, luck: char.luck,
  };
  const enemyAttrs: Attrs & { name: string } = {
    level: enemy.level, str: enemy.str, dex: enemy.dex, intt: enemy.intt, wis: enemy.wis,
    cha: enemy.cha, con: enemy.con, luck: enemy.luck, name: enemy.name,
  };

  // HP inicial do player (aqui é cheio; para coliseu em sequência, passe o HP remanescente)
  const startHP = 30 + playerAttrs.level * 5 + playerAttrs.con * 1;

  const outcome = await resolveCombatFromHP(playerAttrs, enemyAttrs, startHP);

  const { data: inserted, error } = await supabase
    .from("battles")
    .insert({
      user_id: user.id,
      character_id: char.id,
      area,
      enemy_id: enemy.id,
      enemy_name: enemy.name,

      // estado final após a simulação
      player_hp: outcome.playerHPFinal,
      enemy_hp: outcome.enemyHPFinal,
      player_hp_max: startHP,
      enemy_hp_max: 30 + enemy.level * 5 + enemy.con * 1,

      cursor: outcome.log.length,
      status: "finished",
      winner: outcome.winner,       // <<<<<<<<<<<<<< CORRIGIDO
      log: outcome.log,             // jsonb[]
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) return new NextResponse(error.message, { status: 400 });

  return NextResponse.json({
    battle: inserted,
    player_attrs: playerAttrs,
    enemy_attrs: enemyAttrs,
  });
}
