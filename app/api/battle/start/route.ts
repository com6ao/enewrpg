// app/api/battle/start/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

type Attrs = { str: number; dex: number; intt: number; wis: number; cha: number; con: number; luck: number };
type UnitState = { name: string; level: number; hp: number; hpmax: number; attrs: Attrs };

function base(): Attrs {
  return { str: 5, dex: 5, intt: 5, wis: 5, cha: 5, con: 5, luck: 5 };
}
function fromChar(char: any): UnitState {
  const hp = Number(char?.hp ?? 47);
  return {
    name: char?.name ?? "Você",
    level: Number(char?.level ?? 1),
    hp,
    hpmax: hp,
    attrs: {
      str: Number(char?.str ?? 10),
      dex: Number(char?.dex ?? 10),
      intt: Number(char?.intt ?? 10),
      wis: Number(char?.wis ?? 10),
      cha: Number(char?.cha ?? 10),
      con: Number(char?.con ?? 12),
      luck: Number(char?.luck ?? 14),
    },
  };
}
function makeEnemy(area: "creep" | "jungle" | "ancient" | "boss"): UnitState {
  if (area === "creep")  return { name: "Creep",  level: 1,  hp: 38,  hpmax: 38,  attrs: { ...base(), str: 10, dex: 10, intt: 10, wis: 20 } };
  if (area === "jungle") return { name: "Jungle", level: 6,  hp: 68,  hpmax: 68,  attrs: { ...base(), str: 12, dex: 14 } };
  if (area === "ancient")return { name: "Ancient",level: 14, hp: 111, hpmax: 111, attrs: { ...base(), str: 15, dex: 12, intt: 8, wis: 8 } };
  return { name: "Boss",   level: 20, hp: 144, hpmax: 144, attrs: { ...base(), str: 18, dex: 15, con: 16 } };
}

export async function POST(req: Request) {
  try {
    const supabase = await getSupabaseServer();

    const body = await req.json().catch(() => null);
    const area = body?.area as "creep" | "jungle" | "ancient" | "boss" | undefined;
    if (!area) return new NextResponse("Informe a área", { status: 400 });

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) return new NextResponse("Não autenticado", { status: 401 });
    const user_id = authData.user.id;

    // personagem ativo
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("active_character_id")
      .eq("id", user_id)
      .maybeSingle();
    if (pErr) return new NextResponse(pErr.message, { status: 400 });
    if (!profile?.active_character_id) {
      return new NextResponse("Nenhum personagem ativo", { status: 400 });
    }

    const { data: char, error: cErr } = await supabase
      .from("characters")
      .select("*")
      .eq("id", profile.active_character_id)
      .maybeSingle();
    if (cErr) return new NextResponse(cErr.message, { status: 400 });
    if (!char) return new NextResponse("Personagem não encontrado", { status: 400 });

    // monta estados
    const player = fromChar(char);
    const enemy  = makeEnemy(area);

    // INSERT **somente colunas garantidas** do seu schema
    const insertRow: any = {
      user_id,
      character_id: char.id,       // evita o NOT NULL
      area,                        // existe no seu schema
      status: "active",            // "active" | "finished"
      cursor: 0,                   // começa em 0
      player_hp: player.hp,
      enemy_hp: enemy.hp,
      log: [],                     // se "log" é jsonb
      winner: null,                // inicial
      created_at: new Date().toISOString(),
    };

    const { data: battle, error: insErr } = await supabase
      .from("battles")
      .insert(insertRow)
      .select("*")
      .maybeSingle();

    if (insErr || !battle) {
      // propaga o erro real para você ver no alert
      return new NextResponse(insErr?.message || "Erro ao criar batalha", { status: 500 });
    }

    // payload para a página usar
    return NextResponse.json({
      battle: {
        id: battle.id,
        area: battle.area,
        status: battle.status,
        cursor: battle.cursor ?? 0,
        player_hp: battle.player_hp,
        enemy_hp: battle.enemy_hp,
        player_hp_max: player.hpmax,
        enemy_hp_max: enemy.hpmax,
        player_name: player.name,
        enemy_name: enemy.name,
        player_level: player.level,
        enemy_level: enemy.level,
      },
      player_attrs: player.attrs,
      enemy_attrs: enemy.attrs,
    });
  } catch (e: any) {
    return new NextResponse(e?.message || "Erro inesperado", { status: 500 });
  }
}
