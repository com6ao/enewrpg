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

type ResponseData = {
  characters: Character[];
  active_character_id: string | null;
};

export default function CharactersIndex() {
  const [chars, setChars] = useState<Character[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const r = await fetch("/api/characters/list");
      if (!r.ok) return;
      const data: ResponseData = await r.json();
      setChars(data.characters ?? []);
      setActiveId(data.active_character_id ?? null);
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
          {chars.map((c) => {
            const isActive = c.id === activeId;
            return (
              <div
                key={c.id}
                className="card"
                style={{
                  marginBottom: 12,
                  border: isActive ? "2px solid #2ecc71" : undefined,
                  background: isActive ? "#f1fff4" : undefined
                }}
              >
                <div className="card-title">
                  {c.name} {c.surname}
                  {isActive && <span style={{ color: "#2ecc71", marginLeft: 6 }}>(Ativo)</span>}
                </div>
                <div className="muted">
                  {c.universe} · {c.energy} · Lv {c.lvl} · XP {c.xp}
                </div>
              </div>
            );
          })}
        </div>
      }
    </main>
  );
}
