"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type Character = {
  id: string;
  name: string;
  surname: string;
  level: number;
  xp: number;
  str: number; dex: number; intt: number; wis: number; cha: number; con: number; luck: number;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [char, setChar] = useState<Character | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setEmail(user.email ?? null);

      const { data: profile } = await supabase
        .from("profiles")
        .select("active_character_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.active_character_id) { setChar(null); return; }

      const { data: personagem } = await supabase
        .from("characters")
        .select("id,name,surname,level,xp,str,dex,intt,wis,cha,con,luck") // inclui luck
        .eq("id", profile.active_character_id)
        .maybeSingle();

      setChar(personagem as any);
    })();
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <main className="container">
      <h1>Status do Personagem</h1>
      <p>Usuário: {email ?? "carregando..."}</p>
      <button className="btn" onClick={logout}>Sair</button>

      {char ? (
        <div style={{ marginTop: 20 }}>
          <h3>{char.name} — Lv {char.level} / XP {char.xp}</h3>
          <ul>
            <li>Força: {char.str}</li>
            <li>Destreza: {char.dex}</li>
            <li>Inteligência: {char.intt}</li>
            <li>Sabedoria: {char.wis}</li>
            <li>Carisma: {char.cha}</li>
            <li>Constituição: {char.con}</li>
            <li>Sorte: {char.luck}</li>
          </ul>
        </div>
      ) : (
        <p style={{ marginTop: 20 }}>Nenhum personagem ativo. Vá em “Personagens” e selecione um.</p>
      )}
    </main>
  );
}
