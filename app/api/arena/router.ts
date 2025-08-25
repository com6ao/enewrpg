import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { simulateCombat } from '@/lib/combat'

export async function POST() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(_cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {}
      }
    }
  )

  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: character, error: charErr } = await supabase
    .from('characters')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (charErr) return NextResponse.json({ error: charErr.message }, { status: 400 })
  if (!character) return NextResponse.json({ error: 'No character found' }, { status: 404 })

  const combatResult = simulateCombat({
    id: character.id,
    user_id: character.user_id,
    name: character.name,
    level: character.level ?? 1,
    attack: character.attack ?? 5,
    defense: character.defense ?? 5,
    hp: character.hp ?? 30
  })

  await supabase.from('arena_logs').insert({
    user_id: user.id,
    character_id: character.id,
    result: combatResult.outcome,
    details: combatResult.log
  })

  return NextResponse.json({ message: combatResult.outcome })
}
