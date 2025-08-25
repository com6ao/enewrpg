// app/api/arena/route.ts
import { NextResponse } from "next/server";
import { startCombat, stepCombat, type PublicSnapshot, type ClientCmd } from "@/lib/combat";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type Attr = { str:number; dex:number; intt:number; wis:number; con:number; cha:number; luck:number };

async function getPlayerFromDashboard(): Promise<{ name:string; level:number; attrs:Attr }>{
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll(){ return cookieStore.getAll(); },
        set(name:string,value:string,options:any){ cookieStore.set({ name, value, ...options }); },
        remove(name:string,options:any){ cookieStore.set({ name, value:"", ...options, maxAge:0 }); }
      }
    }
  );

  const { data:{ user }, error:authErr } = await supabase.auth.getUser();
  if (authErr || !user) throw new Error("Não autenticado");

  const { data, error } = await supabase
    .from("characters")
    .select("name, level, str, dex, intt, wis, con, cha, luck")
    .eq("user_id", user.id)
    .single();

  if (error || !data) throw new Error("Não foi possível ler atributos");

  const attrs: Attr = {
    str: data.str ?? 10, dex: data.dex ?? 10, intt: data.intt ?? 10,
    wis: data.wis ?? 10, con: data.con ?? 10, cha: data.cha ?? 10, luck: data.luck ?? 10,
  };
  return { name: data.name ?? "Você", level: data.level ?? 1, attrs };
}

type Row = { srv: PublicSnapshot["srv"]; cursor:number; status:"active"|"finished"; winner?: "player"|"enemy"|"draw"|null };
const mem = (globalThis as any).__ARENA__ ?? ((globalThis as any).__ARENA__ = { battles:{} as Record<string,Row> });

export async function POST(req:Request){
  const body = (await req.json().catch(()=>({}))) as any;
  const op = (body?.op ?? "start") as "start"|"step";

  if(op==="start"){
    let snap:PublicSnapshot;
    try{
      const player = await getPlayerFromDashboard();
      snap = startCombat(player);
    }catch{
      snap = startCombat();
    }
    const id = crypto.randomUUID();
    mem.battles[id] = { srv:snap.srv, cursor:0, status:"active", winner:null };
    return NextResponse.json({ id, snap });
  }

  const id = body?.id as string|undefined;
  if(!id || !mem.battles[id]) return new NextResponse("id inválido", { status:400 });

  const row = mem.battles[id];
  const cmd = (body?.cmd ?? undefined) as ClientCmd|undefined;

  const snap = stepCombat(row.srv, cmd);
  row.srv = snap.srv;

  const newLogs = snap.log.slice(row.cursor);
  row.cursor = snap.log.length;

  if (snap.player.hp<=0 || snap.enemy.hp<=0){
    row.status="finished";
    row.winner = snap.player.hp>0 ? "player" : snap.enemy.hp>0 ? "enemy" : "draw";
  }

  return NextResponse.json({ id, snap, lines:newLogs, status:row.status, winner:row.winner ?? null, cursor:row.cursor });
}
