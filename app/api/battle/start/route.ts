// app/api/battle/start/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

type Attrs = { str: number; dex: number; intt: number; wis: number; cha: number; con: number; luck: number };
type UnitState = { name: string; level: number; hp: number; hpmax: number; attrs: Attrs };

function defaults(): Attrs {
  return { str: 5, dex: 5, intt: 5, wis: 5, cha: 5, con: 5, luck: 5 };
}
function fromChar(char: any): UnitState {
  return {
    name: char?.name ?? "Você",
    level: Number(char?.level ?? 1),
    hp: Number(char?.hp ?? 50),
    hpmax: Number(char?.hp ?? 50),
    attrs: {
      str: Number(char?.str ?? 5),
      dex: Number(char?.dex ?? 5),
      intt: Number(char?.intt ?? 5),
      wis: Number(char?.wis ?? 5),
      cha: Number(char?.cha ?? 5),
      con: Number(char?.con ?? 5),
      luck: Number(char?.luck ?? 5),
    },
  };
}
function makeEnemy(area: string): UnitState {
  if (area === "creep")  return { name: "Slime",    level: 1,  hp: 30,  hpmax: 30,  attrs: { ...defaults(), str: 4, con: 4 } };
  if (area === "jungle") return { name: "Wolf",     level: 3,  hp: 60,  hpmax: 60,  attrs: { ...defaults(), dex: 6, str: 6 } };
  if (area === "ancient")return { name: "Centaur",  level: 6,  hp: 90,  hpmax: 90,  attrs: { ...defaults(), str: 8, con: 7 } };
  if (area === "boss")   return { name: "Dragon",   level: 10, hp: 150, hpmax: 150, attrs: { ...defaults(), str: 12, dex: 10, con: 12 } };
  return { name: "Dummy", level: 1, hp: 20, hpmax: 20, attrs: defaults() };
}

export async function POST(req: Request) {
  const supabase = await getSupabaseServer(); // <— correção: await

  const body = await req.json().catch(() => null);
  const area = body?.area as "creep" | "jungle" | "ancient" | "boss" | undefined;
  if (!area) return new NextResponse("Informe a área", { status: 400 });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) return new NextResponse("Não autenticado", { status: 401 });
  const user_id = authData.user.id;

  const { data: profile } = await supabase
    .from("profiles").select("active_character_id").eq("id", user_id).maybeSingle();
  if (!profile?.active_character_id)
    return new NextResponse("Nenhum personagem ativo encontrado", { status: 400 });

  const { data: char } = await supabase
    .from("characters").select("*").eq("id", profile.active_character_id).maybeSingle();
  if (!char) return new NextResponse("Personagem inválido", { status: 400 });

  const player = fromChar(char);
  const enemy  = makeEnemy(area);

  const { data: battle, error: insErr } = await supabase
    .from("battles")
    .insert({
      user_id,
      character_id: char.id,
      area,
      status: "active",
      player_hp: player.hp,
      enemy_hp: enemy.hp,
      created_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();

  if (insErr || !battle) return new NextResponse("Erro ao criar batalha", { status: 500 });

  return NextResponse.json({
    battle: {
      id: battle.id,
      area,
      status: battle.status,
      player_hp: battle.player_hp,
      enemy_hp: battle.enemy_hp,
      player_hp_max: player.hpmax,
      enemy_hp_max: enemy.hpmax,
      player_name: player.name,
      enemy_name: enemy.name,
      player_level: player.level,
      enemy_level: enemy.level,
      player_attrs: player.attrs,
      enemy_attrs: enemy.attrs,
      cursor: 0,
    },
    player_attrs: player.attrs,
    enemy_attrs: enemy.attrs,
  });
}
