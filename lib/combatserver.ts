import { simulateCombat, Character } from './combat'

export function runServerCombat(character: Character) {
  return simulateCombat(character)
}
