import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Não autenticado", { status: 401 });

  const { data, error } = await supabase
    .from("characters")
    .select("*")
    .eq("user_id", user.id);

  if (error) return new NextResponse(error.message, { status: 400 });

  return NextResponse.json(data);
}
