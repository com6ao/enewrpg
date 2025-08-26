"use client";
import { useEffect, useState, useCallback } from "react";

export type Character = {
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

export function useCharacterList() {
  const [chars, setChars] = useState<Character[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const r = await fetch("/api/characters/list");
    if (!r.ok) { setLoading(false); return; }
    const data: ResponseData = await r.json();
    setChars(data.characters ?? []);
    setActiveId(data.active_character_id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { chars, activeId, loading, setChars, setActiveId };
}
