import { NextResponse } from "next/server";
import { startCombat, type PublicSnapshot } from "@/lib/combat";

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
  // body.area existe mas não é usado aqui
  const snap = startCombat();

  const id = crypto.randomUUID();
  store.__BATTLES__![id] = {
    id,
    srv: snap.srv,
    cursor: 0,
    status: "active",
    winner: null,
  };

  return NextResponse.json({
    battle: {
      id,
      enemy_name: snap.enemy.name,
      player_hp: snap.player.hp,
      player_hp_max: snap.player.hpMax,
      enemy_hp: snap.enemy.hp,
      enemy_hp_max: snap.enemy.hpMax,
      cursor: 0,
      status: "active" as const,
      winner: null,
    },
    lines: [] as any[],
    player_attrs: { level: snap.srv.player.level, ...snap.srv.player.attrs },
    enemy_attrs: { level: snap.srv.enemy.level, ...snap.srv.enemy.attrs },
  });
}
