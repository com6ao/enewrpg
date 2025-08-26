"use client";
import Link from "next/link";
import { useCharacterList } from "./useCharacterList";
import type { Character } from "@/types/character";

export default function CharactersIndex() {
 const { chars, activeId, loading } = useCharacterList();

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
