import { supabaseBrowser } from '@/lib/supabaseClient'
import type { Character } from '@/domain/characters/types'

export async function getUserCharacter(): Promise<Character | null> {
  const sb = supabaseBrowser()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null
  const { data } = await sb.from('characters').select('*').eq('user_id', user.id).single()
  return data as Character | null
}
