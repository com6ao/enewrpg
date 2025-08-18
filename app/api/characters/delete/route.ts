// app/api/characters/delete/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: Request) {
  const { character_id } = await req.json();
  if (!character_id) return new NextResponse("character_id obrigatório", { status: 400 });

  const supabase = createServerClient(supabaseUrl, supabaseKey, { cookies });

  const { data: { user }, error: uerr } = await supabase.auth.getUser();
  if (uerr || !user) return new NextResponse("não autenticado", { status: 401 });

  // segurança: só deletar do próprio dono
  const { error: derr } = await supabase
    .from("characters")
    .delete()
    .eq("id", character_id)
    .eq("user_id", user.id);

  if (derr) return new NextResponse(derr.message, { status: 400 });

  // se era o ativo, limpa no profile
  await supabase
    .from("profiles")
    .update({ active_character_id: null })
    .eq("id", user.id)
    .eq("active_character_id", character_id);

  return NextResponse.json({ ok: true });
}
