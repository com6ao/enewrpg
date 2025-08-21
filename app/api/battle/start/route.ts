// app/api/battle/start/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

type Attrs = { str: number; dex: number; intt: number; wis: number; cha: number; con: number; luck: number };
type UnitState = {
  name: string;
  level: number;
  hp: number;
  hpmax: number;
  attrs: Attrs;
};

function defaultAttrs(): Attrs {
  return { str: 5, dex: 5, intt: 5, wis: 5, cha: 5, con: 5, luck: 5 };
}

function buildCharacter(char: any): UnitState {
  return {
    name: char.name ?? "Você",
    level: char.level ?? 1,
    hp: char.hp ?? 50,
    hpmax: char.hp ?? 50,
    attrs: {
      str: char.str ?? 5,
      dex: char.dex ?? 5,
      intt: char.intt ?? 5,
      wis: char.wis ?? 5,
      cha: char.cha ?? 5,
      con: char.con ?? 5,
      luck: char.luck ?? 5,
    },
  };
}

function buildEnemy(area: string): UnitState {
  if (area === "creep") {
    return {
      name: "Slime",
      level: 1,
      hp: 30,
      hpmax: 30,
      attrs: { ...defaultAttrs(), str: 4, con: 4 },
    };
  }
  if (area === "jungle") {
    return {
      name: "Wolf",
      level: 3,
      hp: 60,
      hpmax: 60,
      attrs: { ...defaultAttrs(), dex: 6, str: 6 },
    };
  }
  if (area === "ancient") {
    return {
      name: "Centaur",
      level: 6,
      hp: 90,
      hpmax: 90,
      attrs: { ...defaultAttrs(), str: 8, con: 7 },
    };
  }
  if (area === "boss") {
    return {
      name: "Dragon",
      level: 10,
      hp: 150,
      hpmax: 150,
      attrs: { ...defaultAttrs(), str: 12, dex: 10, con: 12 },
    };
  }
  return {
    name: "Dummy",
    level: 1,
    hp: 20,
    hpmax: 20,
    attrs: defaultAttrs(),
  };
}

export async function POST(req: Request) {
  const supabase = getSupabaseServer();

  const data = await req.json().catch(() => null);
  const area = data?.area;
  if (!area) {
    return new NextResponse("Informe a área", { status: 400 });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return new NextResponse("Não autenticado", { status: 401 });
  }
  const user_id = authData.user.id;

  // personagem ativo do usuário
  const { data: profile } = await supabase.from("profiles").select("active_character_id").eq("id", user_id).single();
  if (!profile?.active_character_id) {
    return new NextResponse("Nenhum personagem ativo encontrado", { status: 400 });
  }

  const { data: char } = await supabase.from("characters").select("*").eq("id", profile.active_character_id).single();
  if (!char) {
    return new NextResponse("Personagem inválido", { status: 400 });
  }

  const playerState = buildCharacter(char);
  const enemyState = buildEnemy(area);

  // cria batalha no banco
  const { data: battle, error: insertErr } = await supabase
    .from("battles")
    .insert({
      user_id,
      character_id: char.id,
      area,
      status: "active",
      player_hp: playerState.hp,
      enemy_hp: enemyState.hp,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertErr || !battle) {
    console.error(insertErr);
    return new NextResponse("Erro ao criar batalha", { status: 500 });
  }

  return NextResponse.json({
    battle: {
      id: battle.id,
      area,
      status: battle.status,
      player_hp: battle.player_hp,
      enemy_hp: battle.enemy_hp,
      player_hp_max: playerState.hpmax,
      enemy_hp_max: enemyState.hpmax,
      player_name: playerState.name,
      enemy_name: enemyState.name,
      player_level: playerState.level,
      enemy_level: enemyState.level,
      player_attrs: playerState.attrs,
      enemy_attrs: enemyState.attrs,
      cursor: 0,
    },
    player_attrs: playerState.attrs,
    enemy_attrs: enemyState.attrs,
  });
}
