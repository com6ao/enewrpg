"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Character = {
  id: string;
  name: string;
  surname: string;
  universe: string;
  energy: string;
  lvl: number;
  xp: number;
};

export default function CharactersIndex() {
  const [chars, setChars] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const r = await fetch("/api/characters/list");
      if (!r.ok) return;
      const data = await r.json();
      setChars(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <main className="container">
      <h1>Criar/Selecionar Personagem</h1>

      <div className="card" style={{ display: "flex", gap: 12 }}>
        <Link className="btn" href="/characters/new">Criar</Link>
        <Link className="btn" href="/characters/select">Selecionar</Link>
      </div>

      {loading ? <p>carregando...</p> :
        <div style={{ marginTop: 24 }}>
          {chars.map((c) => (
            <div key={c.id} className="card" style={{ marginBottom: 12 }}>
              <div className="card-title">{c.name} {c.surname}</div>
              <div className="muted">{c.universe} · {c.energy} · Lv {c.lvl} · XP {c.xp}</div>
            </div>
          ))}
        </div>
      }
    </main>
  );
}
