// lib/combatLog.ts
export type Event =
  | { t: "hit"; src: "player" | "enemy"; dmg: number }
  | { t: "miss"; src: "player" | "enemy" }
  | { t: "crit"; src: "player" | "enemy"; dmg: number }
  | { t: "end"; winner: "player" | "enemy" | "draw" };

// Frases mais genéricas
const rxYouHit = /Você causou\s+(\d+)\s+de dano/i;
const rxOtherHit = /^((?!Você).+?)\s+causou\s+(\d+)\s+de dano/i; // qualquer nome que não comece com "Você"
const rxYouMiss = /Você errou o ataque/i;
const rxOtherMiss = /(Inimigo|.+?) errou o ataque/i;
const rxCrit = /cr[ií]tico/i;

export function parseLog(lines: string[], winnerRaw?: string): Event[] {
  const evs: Event[] = [];

  for (const line of lines) {
    // crítico do player
    if (rxYouHit.test(line) && rxCrit.test(line)) {
      evs.push({ t: "crit", src: "player", dmg: +line.match(rxYouHit)![1] });
      continue;
    }
    // crítico do inimigo (ou qualquer outro nome)
    if (rxOtherHit.test(line) && rxCrit.test(line)) {
      evs.push({ t: "crit", src: "enemy", dmg: +line.match(rxOtherHit)![2] });
      continue;
    }
    // acertos
    if (rxYouHit.test(line)) {
      evs.push({ t: "hit", src: "player", dmg: +line.match(rxYouHit)![1] });
      continue;
    }
    if (rxOtherHit.test(line)) {
      evs.push({ t: "hit", src: "enemy", dmg: +line.match(rxOtherHit)![2] });
      continue;
    }
    // erros
    if (rxYouMiss.test(line)) { evs.push({ t: "miss", src: "player" }); continue; }
    if (rxOtherMiss.test(line)) { evs.push({ t: "miss", src: "enemy" }); continue; }
    // fallback: preserve a linha como “miss” para animar
    evs.push({ t: "miss", src: /Você/i.test(line) ? "player" : "enemy" });
  }

  if (winnerRaw) {
    const w =
      winnerRaw === "player" || /vit[oó]ria/i.test(winnerRaw) ? "player" :
      winnerRaw === "enemy"  || /derrota/i.test(winnerRaw) ? "enemy"  : "draw";
    evs.push({ t: "end", winner: w });
  }
  return evs;
}
