import { NextResponse } from "next/server";
import { startCombat, stepCombat, type ClientCmd, type PublicSnapshot } from "@/lib/combat";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const op = body?.op as "start" | "step";

  if (op === "start") {
    const snap = startCombat();
    return NextResponse.json(snap);
  }

  // step
  const cmd: ClientCmd | undefined = body?.cmd;
  const srv = body?.srv;
  const snap: PublicSnapshot = stepCombat(srv, cmd);
  return NextResponse.json(snap);
}
