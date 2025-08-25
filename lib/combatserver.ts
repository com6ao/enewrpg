import { simulateCombat } from '@/lib/combat'
import type { Character } from '@/domain/characters/types'

export function runServerCombat(character: Character) {
  return simulateCombat(character)
}
