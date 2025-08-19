// Converte linhas do log (string ou objeto) em eventos simples para atualizar HP
import { parseLog, type Event } from "@/lib/combatLog";

export function toEvent(line: any): Event | null {
  // se vier objeto rico do motor
  if (line && typeof line === "object") {
    const dmg = Number(line.damage ?? line.dmg ?? 0);
    if (dmg > 0) {
      return {
        t: "hit",
        src: line.actor === "enemy" ? "enemy" : "player",
        dmg,
      } as Event;
    }
    // errou/desviou => tratamos como 'miss'
    return {
      t: "miss",
      src: line.actor === "enemy" ? "enemy" : "player",
    } as Event;
  }
  // fallback: string → usa regex do combatLog.ts
  const txt = typeof line === "string" ? line : JSON.stringify(line);
  const evs = parseLog([txt]);
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
