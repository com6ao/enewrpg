"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Character = {
  id: string;
  name: string;
  surname: string;
  lvl: number;
  xp: number;
  str: number;
  dex: number;
  intt: number;
  wis: number;
  cha: number;
  con: number;
  // luck pode ser adicionado aqui também quando colocarmos no banco
};

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [char, setChar] = useState<Character | null>(null);

  useEffect(() => {
    async function load() {
      // 1) verificar usuário
      const userResp = await supabase.auth.getUser();
      if (!userResp.data.user) {
        router.push("/login");
        return;
      }
      setEmail(userResp.data.user.email ?? null);

      // 2) buscar profile para saber qual personagem está ativo
      const { data: profile } = await supabase
        .from("profiles")
        .select("active_character_id")
        .eq("id", userResp.data.user.id)
        .maybeSingle();

      if (!profile?.active_character_id) return;

      // 3) carregar personagem ativo
      const { data: personagem } = await supabase
        .from("characters")
        .select("*")
        .eq("id", profile.active_character_id)
        .maybeSingle();

      setChar(personagem as Character);
    }
    load();
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
        <div style={{marginTop:24}}>
          <h2>{char.name} {char.surname} — Lv {char.lvl} / XP {char.xp}</h2>
          <ul>
            <li>Força: {char.str}</li>
            <li>Destreza: {char.dex}</li>
            <li>Inteligência: {char.intt}</li>
            <li>Sabedoria: {char.wis}</li>
            <li>Carisma: {char.cha}</li>
            <li>Constituição: {char.con}</li>
          </ul>
        </div>
      ) : (
        <p style={{marginTop:24}}>Nenhum personagem ativo… Vá em “Personagens” e selecione um!</p>
      )}
    </main>
  );
}
