// app/api/arena/route.ts
import { NextResponse } from "next/server";
import { startCombat, stepCombat, type PublicSnapshot, type ClientCmd } from "@/lib/combat";
import { rollLoot } from "@/lib/loot";
import { getSupabaseServer } from "@/lib/supabaseServer";

type Attr = { str: number; dex: number; intt: number; wis: number; con: number; cha: number; luck: number };

async function getPlayerFromDashboard(): Promise<{
  name: string;
  level: number;
  attrs: Attr;
  gold: number;
  xp: number;
}> {
  const supabase = await getSupabaseServer();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) throw new Error("Não autenticado");

  const { data, error } = await supabase
    .from("characters")
    .select("name, level, xp, gold, str, dex, intt, wis, con, cha, luck")
    .eq("user_id", user.id)
    .single();

  if (error || !data) throw new Error("Não foi possível ler atributos");

  const attrs: Attr = {
    str: data.str ?? 10,
    dex: data.dex ?? 10,
    intt: data.intt ?? 10,
    wis: data.wis ?? 10,
    con: data.con ?? 10,
    cha: data.cha ?? 10,
    luck: data.luck ?? 10,
  };

  const xp =
    typeof data.xp === "number"
      ? Math.trunc(data.xp)
      : parseInt(String(data.xp ?? 0), 10);
  return { name: data.name ?? "Você", level: data.level ?? 1, attrs, gold: data.gold ?? 0, xp };
}

type Row = {
  id: string;
  srv: PublicSnapshot["srv"];
  log_cursor: number;
  status: "active" | "finished";
  winner: "player" | "enemy" | "draw" | null;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as any;
  const op = (body?.op ?? "start") as "start" | "step";

  if (op === "start") {
    let snap: PublicSnapshot;
    try {
      const player = await getPlayerFromDashboard();
      const { gold, ...rest } = player;
      snap = startCombat(rest, gold);
    } catch {
      snap = startCombat();
    }

    const id = crypto.randomUUID();
    try {
      const supabase = await getSupabaseServer();
      const { error: insertErr } = await supabase
        .from("arena_sessions")
        .insert({ id, srv: snap.srv, log_cursor: 0, status: "active", winner: null });
      if (insertErr) throw insertErr;
    } catch (err) {
      console.error("failed to create arena session", err);
      const message =
        if (process.env.NODE_ENV !== "production" && err && typeof err === "object") {
        const { message, details, code } = err as any;
        return NextResponse.json({ error: message, details, code }, { status: 500 });
      }
      return NextResponse.json({ error: "failed to create session" }, { status: 500 });
    }
    return NextResponse.json({ id, snap, gold: snap.srv.gold });
  }

  const id = body?.id as string | undefined;
  if (!id) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  const supabase = await getSupabaseServer();
  const { data: rowData, error: rowErr } = await supabase
    .from("arena_sessions")
    .select("id, srv, log_cursor, status, winner")
    .eq("id", id)
    .single();
  if (rowErr || !rowData) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  const row = rowData as Row;
  const cmd = (body?.cmd ?? undefined) as ClientCmd | undefined;

  const prevGold = row.srv.gold;
  const prevLevel = row.srv.player.level;
  const snap = stepCombat(row.srv, cmd);
  const enemyDefeated = snap.enemyDefeated;
  row.srv = snap.srv;
  const newGold = snap.srv.gold;
  const deltaGold = newGold - prevGold;
  const xpGain = snap.xpGain ?? 0;
  const newLevel = snap.srv.player.level;
  
  if (deltaGold > 0 || xpGain > 0 || newLevel !== prevLevel) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const updates: Record<string, any> = {};
        if (deltaGold > 0) updates.gold = newGold;
        if (xpGain > 0 || newLevel !== prevLevel) {
          updates.xp = Math.trunc(Number(snap.srv.xp ?? 0));
          updates.level = newLevel;
        }
        if (Object.keys(updates).length) {
          const { error: updErr } = await supabase
            .from("characters")
            .update(updates)
            .eq("user_id", user.id);
          if (updErr) console.error("failed to update character", updErr);
        }
      }
    } catch (err) {
      console.error("failed to update character", err);
    }
  }

  const newLogs = snap.log.slice(row.log_cursor);
  row.log_cursor = snap.log.length;

  let drops: any[] = [];
  if (enemyDefeated) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        drops = rollLoot();
        const rows = drops.map(item => ({ owner_user: user.id, character_id: null, ...item }));
        const { error: insertErr } = await supabase
          .from("gear_items")
          .insert(rows);
        if (insertErr) throw insertErr;
      }
    } catch {
      drops = [];
    }
  }

  if (snap.player.hp <= 0 || snap.enemy.hp <= 0) {
    row.status = "finished";
    row.winner = snap.player.hp > 0 ? "player" : snap.enemy.hp > 0 ? "enemy" : "draw";
  }
  try {
    if (row.status === "finished") {
      await supabase.from("arena_sessions").delete().eq("id", id);
    } else {
      const { error: updErr } = await supabase
        .from("arena_sessions")
        .update({ srv: row.srv, log_cursor: row.log_cursor, status: row.status, winner: row.winner })
        .eq("id", id);
      if (updErr) console.error("failed to update arena session", updErr);
    }
  } catch (err) {
    console.error("failed to update arena session", err);
  }

  return NextResponse.json({
    id,
    snap,
    lines: newLogs,
    status: row.status,
    winner: row.winner ?? null,
    log_cursor: row.log_cursor,
    rewards: { gold: newGold, goldDelta: deltaGold, xp: xpGain, level: newLevel, drops },
  });
}
