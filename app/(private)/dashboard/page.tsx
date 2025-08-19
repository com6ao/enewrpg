"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type Character = {
  id: string; name: string; surname: string;
  level: number; xp: number;
  str: number; dex: number; intt: number; wis: number; cha: number; con: number; luck: number;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DashboardPage() {
  const router = useRouter();
  const [char, setChar] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      // perfil -> personagem ativo
      const { data: profile } = await supabase
        .from("profiles")
        .select("active_character_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.active_character_id) { setLoading(false); return; }

      const { data } = await supabase
        .from("characters")
        .select("*")
        .eq("id", profile.active_character_id)
        .maybeSingle();

      setChar(data as Character | null);
      setLoading(false);
    })();
  }, [router]);

  if (loading) return <main className="container">carregando…</main>;
  if (!char) return <main className="container">Nenhum personagem ativo.</main>;

  return (
    <main className="container">
      <h1>Status do Personagem</h1>
      <p><b>{char.name} {char.surname}</b> — Lv {char.level} / XP {char.xp}</p>
      <ul style={{ lineHeight: 1.5 }}>
        <li>Força: {char.str}</li>
        <li>Destreza: {char.dex}</li>
        <li>Inteligência: {char.intt}</li>
        <li>Sabedoria: {char.wis}</li>
        <li>Carisma: {char.cha}</li>
        <li>Constituição: {char.con}</li>
        <li><b>Sorte: {char.luck}</b></li> {/* <- agora imprime o valor correto */}
      </ul>
    </main>
  );
}
