// /api/characters/create/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createBrowserClient } from "@supabase/ssr";
import { resolveEnergy } from "@/lib/rules";

export async function POST(req: Request) {
  const body = await req.json();
  const { name, surname, attrs } = body || {};
  if (!name || !surname || !attrs) {
    return NextResponse.json({ message: "payload inválido" }, { status: 400 });
  }

  // (debug)
  console.log("attrs recebidos:", attrs);

  const cookieStore = cookies();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options?: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options?: any) {
          cookieStore.set({ name, value: "", ...options });
        },
      }
    }
  );

  const { data: user } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Não autenticado", { status: 401 });

  const { data: exists, error: e1 } = await supabase
    .from("characters")
    .select("name")
    .eq("name", name)
    .maybeSingle();
  if (e1) return new NextResponse(e1.message, { status: 400 });
  if (exists) return new NextResponse("Nome já está em uso", { status: 400 });

  const { universe, energy } = resolveEnergy(surname);

  const { error } = await supabase.from("characters").insert({
    user_id: user.id,
    name,
    surname,
    universe,
    energy,
    str: attrs.str,
    dex: attrs.dex,
    intt: attrs.intt,
    wis: attrs.wis,
    cha: attrs.cha,
    con: attrs.con,
    luck: attrs.luck,  // ✅ novo campo
  });

  if (error) return new NextResponse(error.message, { status: 400 });

  return NextResponse.json({ ok: true });
}
