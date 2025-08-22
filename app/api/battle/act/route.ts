import { NextResponse } from "next/server";
import { stepCombat, type PublicSnapshot } from "@/lib/combat";

type BattleRow = {
  id: string;
  srv: PublicSnapshot["srv"];
  cursor: number;
  status: "active" | "finished";
  winner?: "player" | "enemy" | "draw" | null;
};

const store = globalThis as unknown as { __BATTLES__?: Record<string, BattleRow> };
if (!store.__BATTLES__) store.__BATTLES__ = {};

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { battle_id, steps = 1 } = body as { battle_id?: string; steps?: number };

  if (!battle_id) return new NextResponse("battle_id obrigatório", { status: 400 });
  const row = store.__BATTLES__![battle_id];
  if (!row) return new NextResponse("battle não encontrada", { status: 404 });
  if (row.status === "finished") {
    return NextResponse.json({ battle: mapBattle(row.srv), lines: [] as any[] });
  }

  let snap: PublicSnapshot | null = null;
  let produced: any[] = [];

  for (let i = 0; i < steps; i++) {
    snap = stepCombat(row.srv);
    // novos logs desde o cursor anterior
    const newLogs = snap.log.slice(row.cursor);
    produced = produced.concat(newLogs);
    row.cursor = snap.log.length;
    row.srv = snap.srv;

    if (snap.player.hp <= 0 || snap.enemy.hp <= 0) {
      row.status = "finished";
      row.winner =
        snap.player.hp <= 0 && snap.enemy.hp <= 0
          ? "draw"
          : snap.player.hp > 0
          ? "player"
          : "enemy";
      break;
    }
  }

  const battle = mapBattle(row.srv);
  battle.cursor = row.cursor;
  battle.status = row.status;
  battle.winner = row.winner ?? null;

  return NextResponse.json({ battle, lines: produced });
}

function mapBattle(srv: PublicSnapshot["srv"]) {
  return {
    id: "n/a",
    enemy_name: srv.enemy.name,
    player_hp: srv.player.hp,
    player_hp_max: srv.player.hpMax,
    enemy_hp: srv.enemy.hp,
    enemy_hp_max: srv.enemy.hpMax,
    cursor: 0,
    status: "active" as const,
    winner: null as "player" | "enemy" | "draw" | null,
  };
}
