"use client";

import Link from "next/link";
import { useMemo } from "react";
import useCharacterList from "../useCharacterList";
import { useCharacterList } from "../useCharacterList";

export default function CharactersSelectPage() {
  const { chars, activeId, loading } = useCharacterList();

  const ordered = useMemo(() => {
    return [...(chars ?? [])].sort((a, b) =>
      (a.id === activeId ? -1 : 0) - (b.id === activeId ? -1 : 0)
    );
  }, [chars, activeId]);
  const { chars, activeId, loading, setChars, setActiveId } = useCharacterList();

  return (
    <main className="container">
      <header className="py-4 flex items-center justify-between">
        <h1>Selecionar Personagem</h1>
        <Link className="btn" href="/app/(private)/characters">
          Voltar
        </Link>
      </header>

      {loading ? (
        <p>Carregando…</p>
      ) : (
        <section className="grid gap-3">
          {ordered.map((c) => (
          {chars.map((c) => (
            <div key={c.id} className="card p-4">
              <div className="card-title flex items-center gap-2">
                <span>{c.name ?? "Sem nome"}</span>
                {activeId === c.id && <span className="badge">Ativo</span>}
              </div>
              <div className="mt-2 text-sm opacity-80">
                <div>Nível: {c.lvl ?? 1}</div>
                <div>XP: {c.xp ?? 0}</div>
              </div>
              {/* Coloque aqui botões de ativar/excluir quando suas APIs estiverem prontas */}
              <div className="mt-3 flex gap-2">
                <button
                  className="btn"
                  onClick={() => setActiveId(c.id)}
                >
                  Selecionar
                </button>
                <button
                  className="btn"
                  onClick={() => setChars((list) => list.filter((x) => x.id !== c.id))}
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
          {ordered.length === 0 && (
          {chars.length === 0 && (
            <div className="card p-4">
              <p>Nenhum personagem encontrado.</p>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
