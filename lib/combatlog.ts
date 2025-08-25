export type CombatLogEntry = {
  round: number
  actor: string
  action: string
  value: number
}

export function formatLog(log: CombatLogEntry[]): string[] {
  return log.map(e => `Rodada ${e.round}: ${e.actor} ${e.action} ${e.value}.`)
}
