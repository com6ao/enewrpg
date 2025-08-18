export type Event =
  | { t: "hit"; src: "player" | "enemy"; dmg: number }
  | { t: "miss"; src: "player" | "enemy" }
  | { t: "crit"; src: "player" | "enemy"; dmg: number }
  | { t: "end"; winner: "player" | "enemy" | "draw" };

const rxHit = /Você causou (\d+) de dano/i;
const rxEnemyHit = /Inimigo causou (\d+) de dano/i;
const rxMissYou = /Você errou o ataque/i;
const rxMissEnemy = /Inimigo errou o ataque/i;
const rxCritYou = /acerto crítico!\s*Você causou (\d+) de dano/i;
const rxCritEnemy = /acerto crítico!\s*Inimigo causou (\d+) de dano/i;

export function parseLog(lines: string[], winnerRaw?: string): Event[] {
  const evs: Event[] = [];
  for (const line of lines) {
    if (rxCritYou.test(line)) { evs.push({ t: "crit", src: "player", dmg: +line.match(rxCritYou)![1] }); continue; }
    if (rxCritEnemy.test(line)) { evs.push({ t: "crit", src: "enemy", dmg: +line.match(rxCritEnemy)![1] }); continue; }
    if (rxHit.test(line)) { evs.push({ t: "hit", src: "player", dmg: +line.match(rxHit)![1] }); continue; }
    if (rxEnemyHit.test(line)) { evs.push({ t: "hit", src: "enemy", dmg: +line.match(rxEnemyHit)![1] }); continue; }
    if (rxMissYou.test(line)) { evs.push({ t: "miss", src: "player" }); continue; }
    if (rxMissEnemy.test(line)) { evs.push({ t: "miss", src: "enemy" }); continue; }
  }
  if (winnerRaw) {
    const w = winnerRaw === "player" || /vitória/i.test(winnerRaw) ? "player"
            : winnerRaw === "enemy" || /derrota/i.test(winnerRaw) ? "enemy"
            : "draw";
    evs.push({ t: "end", winner: w });
  }
  return evs;
}
