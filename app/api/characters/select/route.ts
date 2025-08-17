import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  const { character_id } = await req.json();
  if (!character_id) return new NextResponse("payload inválido", { status: 400 });

  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Não autenticado", { status: 401 });

  // verificar se personagem pertence ao usuário
  const { data: char, error: e1 } = await supabase
    .from("characters")
    .select("id")
    .eq("id", character_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (e1) return new NextResponse(e1.message, { status: 400 });
  if (!char) return new NextResponse("Personagem inválido", { status: 400 });

  // salvar como ativo na tabela profiles
  const { error: e2 } = await supabase
    .from("profiles")
    .upsert({ id: user.id, active_character_id: character_id }); // cria se não existir

  if (e2) return new NextResponse(e2.message, { status: 400 });

  return NextResponse.json({ ok: true });
}
