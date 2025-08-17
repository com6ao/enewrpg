// app/auth/callback/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options?: any) =>
          cookieStore.set({ name, value, ...(options || {}) }),
        remove: (name: string, options?: any) =>
          cookieStore.set({ name, value: '', ...(options || {}) }),
      },
    }
  )

  if (code) {
    // Troca o code por sessão e grava o cookie httpOnly
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(new URL('/characters/select', url.origin))
}
