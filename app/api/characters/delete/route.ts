// app/api/characters/delete/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: Request) {
  const { character_id } = await req.json();
  if (!character_id) return new NextResponse("character_id obrigatório", { status: 400 });

  const cookieStore = cookies();
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set({ name, value, ...options })
        );
      },
    },
  });

  const { data: { user }, error: uerr } = await supabase.auth.getUser();
  if (uerr || !user) return new NextResponse("não autenticado", { status: 401 });

  const { error: derr } = await supabase
    .from("characters")
    .delete()
    .eq("id", character_id)
    .eq("user_id", user.id);
  if (derr) return new NextResponse(derr.message, { status: 400 });

  await supabase
    .from("profiles")
    .update({ active_character_id: null })
    .eq("id", user.id)
    .eq("active_character_id", character_id);

  return NextResponse.json({ ok: true });
}
