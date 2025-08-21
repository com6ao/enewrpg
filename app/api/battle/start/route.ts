import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

type Attrs = { str:number; dex:number; intt:number; wis:number; cha:number; con:number; luck:number; level:number };

const clamp = (n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const hpFrom = (level:number, con:number) => Math.max(1, 30 + 2*level + 3*con);

export async function POST(req: Request) {
  const { area } = await req.json().catch(()=>({}));
  if (!area) return new NextResponse("Informe a área", { status: 400 });

  const supabase = await getSupabaseServer();

  // auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Não autenticado", { status: 401 });

  // personagem ativo
  const { data: profile } = await supabase
    .from("profiles").select("active_character_id").eq("id", user.id).maybeSingle();
  if (!profile?.active_character_id) return new NextResponse("Nenhum personagem ativo", { status: 400 });

  const { data: char } = await supabase
    .from("characters")
    .select("*")
    .eq("id", profile.active_character_id)
    .maybeSingle();
  if (!char) return new NextResponse("Personagem não encontrado", { status: 400 });

  // sorteia inimigo por categoria
  const { data: enemies } = await supabase
    .from("enemies").select("*").eq("category", area);
  if (!enemies?.length) return new NextResponse("Nenhum inimigo para esta área", { status: 400 });
  const enemy = enemies[Math.floor(Math.random()*enemies.length)];

  // attrs
  const player_attrs: Attrs = {
    level: Number(char.level ?? 1),
    str: Number(char.str ?? 5),
    dex: Number(char.dex ?? 5),
    intt: Number(char.intt ?? 5),
    wis: Number(char.wis ?? 5),
    cha: Number(char.cha ?? 5),
    con: Number(char.con ?? 5),
    luck: Number(char.luck ?? 5),
  };
  const enemy_attrs: Attrs = {
    level: Number(enemy.level ?? 1),
    str: Number(enemy.str ?? 5),
    dex: Number(enemy.dex ?? 5),
    intt: Number(enemy.intt ?? 5),
    wis: Number(enemy.wis ?? 5),
    cha: Number(enemy.cha ?? 5),
    con: Number(enemy.con ?? 5),
    luck: Number(enemy.luck ?? 5),
  };

  // HPs iniciais
  const pHpMax = hpFrom(player_attrs.level, player_attrs.con);
  const eHpMax = hpFrom(enemy_attrs.level, enemy_attrs.con);

  // cria batalha
  const { data: inserted, error } = await supabase
    .from("battles")
    .insert({
      user_id: user.id,
      area,
      status: "active",
      cursor: 0,
      winner: null,
      player_name: "Você",
      enemy_name: enemy.name,
      player_level: player_attrs.level,
      enemy_level: enemy_attrs.level,
      player_hp: pHpMax,
      player_hp_max: pHpMax,
      enemy_hp: eHpMax,
      enemy_hp_max: eHpMax,
      player_attrs,
      enemy_attrs,
      log: [],
      gauges: {},
    })
    .select("*")
    .single();

  if (error) return new NextResponse(error.message, { status: 400 });

  return NextResponse.json({
    battle: inserted,
    player_attrs,
    enemy_attrs,
  });
}
