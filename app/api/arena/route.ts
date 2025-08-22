import { NextResponse } from "next/server";
import { startCombat, stepCombat, type PublicSnapshot } from "@/lib/combat";

type Row = { srv: PublicSnapshot["srv"]; cursor: number; status:"active"|"finished"; winner?: "player"|"enemy"|"draw"|null };
const mem = (globalThis as any).__ARENA__ ?? ((globalThis as any).__ARENA__ = { battles:{} as Record<string,Row> });

export async function POST(req: Request) {
  const body = await req.json().catch(()=> ({} as any));
  const op = (body?.op ?? "start") as "start"|"step";

  if (op === "start") {
    const snap = startCombat();
    const id = crypto.randomUUID();
    mem.battles[id] = { srv: snap.srv, cursor: 0, status: "active", winner: null };
    return NextResponse.json({ id, snap });
  }

  // step
  const id = body?.id as string | undefined;
  if (!id || !mem.battles[id]) return new NextResponse("id inválido", { status: 400 });

  const row = mem.battles[id];
  const snap = stepCombat(row.srv);
  row.srv = snap.srv;
  const newLogs = snap.log.slice(row.cursor);
  row.cursor = snap.log.length;

  if (snap.player.hp <= 0 || snap.enemy.hp <= 0) {
    row.status = "finished";
    row.winner = snap.player.hp > 0 ? "player" : snap.enemy.hp > 0 ? "enemy" : "draw";
  }

  return NextResponse.json({ id, snap, lines: newLogs, status: row.status, winner: row.winner ?? null, cursor: row.cursor });
}
