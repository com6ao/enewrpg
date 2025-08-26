"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import useCharacterList from "./useCharacterList";

type Character = {
  id: string;
  name?: string | null;
  surname?: string | null;
  universe?: string | null;
  energy?: number | null;
  lvl?: number | null;
  xp?: number | null;
};

export default function CharactersIndex() {
  const { chars, activeId, loading } = useCharacterList();
  const [list, setList] = useState<Character[]>([]);

  useEffect(() => {
    setList(chars ?? []);
  }, [chars]);

  return (
    <main className="container">
      <header className="py-4 flex items-center justify-between">
        <h1>Criar/Selecionar Personagem</h1>
        <Link className="btn" href="/app/(private)/characters/select">
          Selecionar
        </Link>
      </header>

      {loading ? (
        <p>Carregando…</p>
      ) : list.length === 0 ? (
      ) : chars.length === 0 ? (
        <section className="card p-4">
          <h2 className="card-title">Nenhum personagem</h2>
          <p>Crie um personagem para começar.</p>
          <div className="mt-3">
            <Link className="btn" href="/app/(private)/characters/select">
              Criar/Selecionar
            </Link>
          </div>
        </section>
      ) : (
        <section className="grid gap-3">
          {list.map((c) => (
            <div key={c.id} className="card p-4">
          {chars.map((c) => (
            <div key={c.id} className="card">
              <div className="card-title flex items-center gap-2">
                <span>{c.name ?? "Sem nome"}</span>
                {activeId === c.id && (
                  <span className="badge">Ativo</span>
                )}
                {activeId === c.id && <span className="badge">Ativo</span>}
              </div>
              <div className="mt-2 text-sm opacity-80">
              <div className="card-body text-sm opacity-80">
                <div>Nível: {c.lvl ?? 1}</div>
                <div>XP: {c.xp ?? 0}</div>
                <div>Energia: {c.energy ?? 0}</div>
              </div>
              <div className="mt-3">
                <Link
                  className="btn"
                  href={`/app/(private)/characters/select?focus=${c.id}`}
                >
                  Gerenciar
                </Link>
                <div className="mt-3">
                  <Link
                    className="btn"
                    href={`/app/(private)/characters/select?focus=${c.id}`}
                  >
                    Gerenciar
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
