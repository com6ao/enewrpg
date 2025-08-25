// app/auth/callback/route.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login?e=missing_code", req.url));

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set({ name, value, ...(options ?? {}) })
          );
        },
      },
    }
  );

  // troca o código pelo token e grava cookies
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  // opcional: trate erro -> redirecione para /login com mensagem
  return NextResponse.redirect(new URL("/", req.url));
}
