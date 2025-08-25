import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Não autenticado", { status: 401 });

  // 1) Buscar perfis (para saber qual personagem está ativo)
  const { data: profile } = await supabase
    .from("profiles")
    .select("active_character_id")
    .eq("id", user.id)
    .maybeSingle();

  // 2) Buscar personagens
  const { data: chars, error } = await supabase
    .from("characters")
    .select("*")
    .eq("user_id", user.id);

  if (error) return new NextResponse(error.message, { status: 400 });

  return NextResponse.json({
    characters: chars,
    active_character_id: profile?.active_character_id ?? null,
  });
}
