// lib/battleServer.ts
import { parseLog } from "@/lib/combatLog";
import type { Event } from "@/lib/combatLog";

// aceita string ou objeto { text, ... }
export function toEvent(line: any): Event | null {
  const text = typeof line === "string" ? line : (line?.text ?? JSON.stringify(line));
  const evs = parseLog([text]);
  return evs[0] ?? null;
}

export function applyEvent(
  state: { player_hp: number; enemy_hp: number },
  ev: Event
) {
  if (ev.t === "hit" || ev.t === "crit") {
    if (ev.src === "player") state.enemy_hp = Math.max(0, state.enemy_hp - ev.dmg);
    else state.player_hp = Math.max(0, state.player_hp - ev.dmg);
  }
}
