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

type UIBattle = {
  id: string;
  enemy_name: string;
  player_hp: number;
  player_hp_max: number;
  enemy_hp: number;
  enemy_hp_max: number;
  cursor: number;
  status: "active" | "finished";
  winner: "player" | "enemy" | "draw" | null;
};

function baseFromSrv(srv: PublicSnapshot["srv"]) {
  return {
    enemy_name: srv.enemy.name,
    player_hp: srv.player.hp,
    player_hp_max: srv.player.hpMax,
    enemy_hp: srv.enemy.hp,
    enemy_hp_max: srv.enemy.hpMax,
  };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { battle_id, steps = 1 } = body as { battle_id?: string; steps?: number };

  if (!battle_id) return new NextResponse("battle_id obrigatório", { status: 400 });
  const row = store.__BATTLES__![battle_id];
  if (!row) return new NextResponse("battle não encontrada", { status: 404 });

  let snap: PublicSnapshot | null = null;
  let produced: any[] = [];

  for (let i = 0; i < steps; i++) {
    snap = stepCombat(row.srv);
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

  const base = baseFromSrv(row.srv);
  const battle: UIBattle = {
    id: battle_id,
    ...base,
    cursor: row.cursor,
    status: row.status,
    winner: row.winner ?? null,
  };

  return NextResponse.json({ battle, lines: produced });
}
