export type Character = {
  id: string
  name: string
  level: number
  attack: number
  defense: number
  hp: number
}

export type CombatResult = {
  outcome: string
  log: string[]
}

export function simulateCombat(player: Character): CombatResult {
  const enemy = {
    name: 'Inimigo Genérico',
    level: player.level,
    attack: player.attack * 0.8,
    defense: player.defense * 0.8,
    hp: player.hp * 0.9,
  }

  let playerHp = player.hp
  let enemyHp = enemy.hp
  const log: string[] = []

  let round = 1
  while (playerHp > 0 && enemyHp > 0 && round < 20) {
    const playerDmg = Math.max(1, player.attack - enemy.defense)
    const enemyDmg = Math.max(1, enemy.attack - player.defense)

    enemyHp -= playerDmg
    log.push(`Rodada ${round}: ${player.name} causa ${playerDmg} de dano.`)

    if (enemyHp <= 0) break

    playerHp -= enemyDmg
    log.push(`Rodada ${round}: ${enemy.name} causa ${enemyDmg} de dano.`)

    round++
  }

  let outcome: string
  if (playerHp > 0 && enemyHp <= 0) outcome = 'Vitória!'
  else if (enemyHp > 0 && playerHp <= 0) outcome = 'Derrota!'
  else outcome = 'Empate.'

  return { outcome, log }
}
