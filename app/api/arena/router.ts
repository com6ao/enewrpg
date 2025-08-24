import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { simulateCombat } from '@/lib/combat'

export async function POST() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookies) { cookies.forEach(({ name, value, options }) => cookieStore.set({ name, value, ...options })) }
      }
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Buscar personagem do usuário
  const { data: character } = await supabase
    .from('characters')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!character) {
    return NextResponse.json({ error: 'No character found' }, { status: 404 })
  }

  // Simula combate
  const combatResult = simulateCombat(character)

  // Salva log
  await supabase.from('arena_logs').insert({
    user_id: user.id,
    character_id: character.id,
    result: combatResult.outcome,
    details: combatResult.log
  })

  return NextResponse.json({ message: combatResult.outcome })
}
