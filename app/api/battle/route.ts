import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { resolveCombat, Attrs } from "@/lib/combat";

// áreas válidas: "creep", "jungle", "ancient", "boss"
export async function POST(req: Request) {
  const { area } = await req.json();
  if (!area) return new NextResponse("Informe a área", { status: 400 });

  const supabase = await getSupabaseServer();

  // pegar usuário logado
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Não autenticado", { status: 401 });

  // pegar personagem ativo
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

  // sorteia inimigo
  const { data: enemies } = await supabase
    .from("enemies")
    .select("*")
    .eq("category", area);

  if (!enemies || !enemies.length) {
    return new NextResponse("Nenhum inimigo para esta área", { status: 400 });
  }

  const enemy = enemies[Math.floor(Math.random() * enemies.length)];

  // monta objetos Attrs para o resolver
  const playerAttrs: Attrs = {
    level: char.level,
    str: char.str,
    dex: char.dex,
    intt: char.intt,
    wis: char.wis,
    cha: char.cha,
    con: char.con,
    luck: char.luck,
  };

  const enemyAttrs: Attrs & { name: string } = {
    level: enemy.level,
    str: enemy.str,
    dex: enemy.dex,
    intt: enemy.intt,
    wis: enemy.wis,
    cha: enemy.cha,
    con: enemy.con,
    luck: enemy.luck,
    name: enemy.name,
  };

  const result = await resolveCombat(playerAttrs, enemyAttrs);

  return NextResponse.json({
    enemy: {
      id: enemy.id,
      name: enemy.name,
      level: enemy.level,
    },
    ...result,
  });
}
