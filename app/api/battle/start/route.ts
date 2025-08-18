import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { resolveCombat, Attrs } from "@/lib/combat";

export async function POST(req: Request) {
  const { area } = await req.json();
  if (!area) return new NextResponse("Informe a área", { status: 400 });

  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Não autenticado", { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("active_character_id").eq("id", user.id).maybeSingle();
  if (!profile?.active_character_id)
    return new NextResponse("Nenhum personagem ativo", { status: 400 });

  const { data: char } = await supabase
    .from("characters").select("*").eq("id", profile.active_character_id).maybeSingle();
  if (!char) return new NextResponse("Personagem não encontrado", { status: 400 });

  const { data: enemies } = await supabase
    .from("enemies").select("*").eq("category", area);
  if (!enemies?.length) return new NextResponse("Nenhum inimigo nesta área", { status: 400 });

  const enemy = enemies[Math.floor(Math.random() * enemies.length)];

  const playerAttrs: Attrs = {
    level: char.level, str: char.str, dex: char.dex, intt: char.intt,
    wis: char.wis, cha: char.cha, con: char.con, luck: char.luck,
  };
  const enemyAttrs: Attrs & { name: string } = {
    level: enemy.level, str: enemy.str, dex: enemy.dex, intt: enemy.intt,
    wis: enemy.wis, cha: enemy.cha, con: enemy.con, luck: enemy.luck, name: enemy.name,
  };

  // Resolve combate completo e salva no banco
  const outcome = await resolveCombat(playerAttrs, enemyAttrs);
  const log = Array.isArray(outcome?.log) ? outcome.log : [];
  const playerMax = outcome?.playerMaxHp ?? 100;
  const enemyMax  = outcome?.enemyMaxHp  ?? 100;

  const { data: inserted, error } = await supabase
    .from("battles")
    .insert({
      user_id: user.id,
      character_id: char.id,
      area,
      enemy_id: enemy.id,
      enemy_name: enemy.name,
      player_hp: playerMax,
      player_hp_max: playerMax,
      enemy_hp: enemyMax,
      enemy_hp_max: enemyMax,
      log,
      status: "active",
      cursor: 0,
    })
    .select("*").single();

  if (error) return new NextResponse(error.message, { status: 400 });

  return NextResponse.json({ battle: inserted });
}
