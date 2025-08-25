export type CombatOutcome = 'Vitória!' | 'Derrota!' | 'Empate.'
export type CombatLog = string[]
export type CombatResult = { outcome: CombatOutcome; log: CombatLog }
