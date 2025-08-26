"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

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
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }
    const r = await fetch("/api/characters/list", { credentials: "include" });
    if (r.ok) {
      const data: ResponseData = await r.json();
      setChars(data.characters ?? []);
      setActiveId(data.active_character_id ?? null);
    } else if (r.status === 401) {
      window.location.href = "/login";
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { chars, activeId, loading, setChars, setActiveId };
}
