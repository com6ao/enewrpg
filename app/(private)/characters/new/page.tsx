"use client";

import { useState } from "react";
import { ALL_SURNAMES } from "@/lib/rules";

/** Dicas de cada atributo, conforme lib/formulas.ts */
const ATTR_HELP: Record<
  "str" | "dex" | "intt" | "wis" | "cha" | "con" | "luck",
  string
> = {
  str:  "Dano físico corpo‑a‑corpo = STR×1.8; também entra em resistência física (melee). Pode ser principal para MP.",
  dex:  "Velocidade de ataque com WIS; dano à distância = DEX + STR×0.5; resistência física (ranged); esquiva.",
  intt: "Dano mágico = INT×1.8; compõe resistência mágica. Pode ser principal para MP.",
  wis:  "Velocidade de ataque/cast; dano mental = WIS; resistência mental; chance de dano verdadeiro.",
  cha:  "Resistência a críticos; chance de redução de dano; aumenta multiplicador de crítico.",
  con:  "Aumenta HP e parte do MP; compõe resistências física/mágica/mental.",
  luck: "Define chance de crítico (até 60%).",
};

/** Estilo do balão “?” */
const helpStyle: React.CSSProperties = {
  display: "inline-grid",
  placeItems: "center",
  width: 16,
  height: 16,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,.35)",
  color: "#fff",
  fontSize: 11,
  cursor: "help",
  opacity: 0.9,
};

type AttrKey = "str" | "dex" | "intt" | "wis" | "cha" | "con" | "luck";
type Attrs = Record<AttrKey, number>;

export default function NewCharacterPage() {
  const [name, setName] = useState("");
  const [surname, setSurname] = useState(ALL_SURNAMES[0]);
  const [pts, setPts] = useState(20);

  const [attr, setAttr] = useState<Attrs>({
    str: 10,
    dex: 10,
    intt: 10,
    wis: 10,
    cha: 10,
    con: 10,
    luck: 10,
  });

  const rows: { label: string; key: AttrKey }[] = [
    { label: "Força", key: "str" },
    { label: "Destreza", key: "dex" },
    { label: "Inteligência", key: "intt" },
    { label: "Sabedoria", key: "wis" },
    { label: "Carisma", key: "cha" },
    { label: "Constituição", key: "con" },
    { label: "Sorte", key: "luck" },
  ];

  function inc(k: AttrKey) {
    if (pts <= 0) return;
    setAttr((a) => ({ ...a, [k]: a[k] + 1 }));
    setPts((p) => p - 1);
  }

  function dec(k: AttrKey) {
    if (attr[k] <= 1) return;
    setAttr((a) => ({ ...a, [k]: a[k] - 1 }));
    setPts((p) => p + 1);
  }

  async function submit() {
    const r = await fetch("/api/characters/create", {
      method: "POST",
      body: JSON.stringify({ name, surname, attrs: attr }),
    });
    if (!r.ok) return alert("erro!");
    location.href = "/characters/select";
  }

  return (
    <div className="container">
      <h1>Criar personagem</h1>

      <div className="grid" style={{ display: "grid", gap: 12 }}>
        {/* Nome */}
        <label className="field">
          <span>Nome</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="nome único"
          />
        </label>

        {/* Sobrenome */}
        <label className="field">
          <span>Sobrenome</span>
          <select
            className="input"
            value={surname}
            onChange={(e) => setSurname(e.target.value)}
          >
            {ALL_SURNAMES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        {/* Pontos restantes */}
        <div className="muted">Pontos distribuíveis: {pts}</div>

        {/* Atributos */}
        <div
          className="grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0,1fr))",
            gap: 12,
          }}
        >
          {rows.map(({ label, key }) => (
            <div key={key} className="card" style={{ padding: 12 }}>
              <div
                className="card-title"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <span>{label}</span>
                <span
                  title={ATTR_HELP[key]}
                  style={helpStyle}
                  aria-label={`Ajuda sobre ${label}`}
                >
                  ?
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  justifyContent: "space-between",
                  marginTop: 8,
                }}
              >
                <button className="btn" onClick={() => dec(key)}>
                  −
                </button>
                <div style={{ minWidth: 64, textAlign: "center" }}>
                  {attr[key]}
                </div>
                <button
                  className="btn"
                  onClick={() => inc(key)}
                  disabled={pts <= 0}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          className="btn"
          onClick={submit}
          disabled={!name || pts !== 0}
          style={{ marginTop: 12 }}
          title={!name ? "Informe um nome" : pts !== 0 ? "Distribua todos os pontos" : ""}
        >
          Criar
        </button>
      </div>
    </div>
  );
}
