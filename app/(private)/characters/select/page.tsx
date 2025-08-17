"use client";

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

export default function SelectCharacterPage() {
  const [chars, setChars] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const r = await fetch("/api/characters/list");
      const data = await r.json();
      setChars(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function selectCharacter(id: string) {
    const r = await fetch("/api/characters/select", {
      method: "POST",
      body: JSON.stringify({ character_id: id }),
    });
    if (!r.ok) { alert(await r.text()); return; }
    location.href = "/dashboard";
  }

  return (
    <main className="container">
      <h1>Selecionar Personagem</h1>
      {loading ? <p>carregando...</p> :
        chars.map((c) => (
          <div key={c.id} className="card" style={{marginBottom:12}}>
            <div className="card-title">{c.name} {c.surname}</div>
            <div className="muted">{c.universe} · {c.energy} · Lv {c.lvl} · XP {c.xp}</div>
            <button className="btn" onClick={() => selectCharacter(c.id)}>Selecionar</button>
          </div>
        ))
      }
    </main>
  );
}
