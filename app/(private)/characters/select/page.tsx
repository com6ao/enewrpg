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
import { useCharacterList } from "../useCharacterList";

export default function SelectCharacterPage() {
  const [chars, setChars] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const r = await fetch("/api/characters/list");
      const data = await r.json();
      setChars(data.characters ?? []);
      setActiveId(data.active_character_id ?? null);
      setLoading(false);
    }
    load();
  }, []);
  const { chars, activeId, loading, setChars, setActiveId } = useCharacterList();

  async function selectCharacter(id: string) {
    const r = await fetch("/api/characters/select", {
      method: "POST",
      body: JSON.stringify({ character_id: id }),
    });
    if (!r.ok) { alert(await r.text()); return; }
    location.href = "/dashboard";
  }

  async function deleteCharacter(id: string) {
    const ok = confirm("Excluir este personagem? Esta ação não pode ser desfeita.");
    if (!ok) return;
    const r = await fetch("/api/characters/delete", {
      method: "POST",
      body: JSON.stringify({ character_id: id }),
    });
    if (!r.ok) { alert(await r.text()); return; }
    setChars(prev => prev.filter(c => c.id !== id));
    if (activeId === id) setActiveId(null);
  }

  return (
    <main className="container">
      <h1>Selecionar Personagem</h1>
