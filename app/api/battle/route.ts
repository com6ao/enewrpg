// app/api/battle/start/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

type Attrs = {
  str: number; dex: number; intt: number; wis: number;
  cha: number; con: number; luck: number;
  level: number; hp: number; hpmax: number;
};

type UnitState = {
  name: string;
  level: number;
  hp: number;
  hpmax: number;
  attrs: Attrs;
};

// ===== helpers =====
function defaultAttrs(): Attrs {
  return { str: 5, dex: 5, intt: 5, wis: 5, cha: 5, con: 5, luck: 5, level: 1, hp: 10, hpmax: 10 };
}

function buildAttrsFromCharacter(char: any): Attrs {
  return {
    str: char.str ?? 5,
    dex: char.dex ?? 5,
    intt: char.intt ?? 5,
    wis: char.wis ?? 5,
    cha: char.cha ?? 5,
    con: char.con ?? 5,
    luck: char.luck ?? 5,
    level: char.level ?? 1,
    hp: char.hp ?? 10,
    hpmax: char.hpmax ?? 10,
  };
}

function buildAttrsFromEnemy(enemy: any): Attrs {
  return {
    str: enemy.str ?? 5,
    dex: enemy.dex ?? 5,
    intt: enemy.intt ?? 5,
    wis: enemy.wis ?? 5,
    cha: enemy.cha ?? 5,
    con: enemy.con ?? 5,
    luck: enemy.luck ?? 5,
    level: enemy.level ?? 1,
    hp: enemy.hp ?? 10,
    hpmax: enemy.hp ?? 10,
  };
}

// ===== handler =====
export async function POST(req: Request) {
  const { area } = await req.json().catch(() => ({}));
  if (!area) return NextResponse.json({ error: "Informe a área." }, { status: 400 });

  const supabase = await getSupabaseServer();

  // usuário autenticado
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // perfil ativo
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, active_character_id")
    .eq("id", user.user.id)
    .single();

  if (!profile?.active_character_id) {
    return NextResponse.json({ error: "Nenhum personagem ativo." }, { status: 400 });
  }

  // personagem
  const { data: character } = await supabase
    .from("characters")
    .select("*")
    .eq("id", profile.active_character_id)
    .single();

  if (!character) {
    return NextResponse.json({ error: "Personagem não encontrado." }, { status: 400 });
  }

  const player_attrs = buildAttrsFromCharacter(character);

  // inimigo
  const { data: enemies } = await supabase
    .from("enemies")
    .select("*")
    .eq("category", area);

  if (!enemies?.length) {
    return NextResponse.json({ error: "Nenhum inimigo para esta área." }, { status: 400 });
  }
  const enemy = enemies[Math.floor(Math.random() * enemies.length)];
  const enemy_attrs = buildAttrsFromEnemy(enemy);

  // valores de HP
  const pHpMax = player_attrs.hpmax;
  const eHpMax = enemy_attrs.hpmax;

  // criar batalha
  const { data: inserted, error } = await supabase
    .from("battles")
    .insert({
      user_id: user.user.id,
      character_id: profile.active_character_id, // IMPORTANTE
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

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    battle: inserted,
    player_attrs,
    enemy_attrs,
  });
}
