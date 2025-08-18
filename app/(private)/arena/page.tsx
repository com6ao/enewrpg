"use client";

import { useState } from "react";

export default function ArenaPage() {
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<any | null>(null);

  async function startBattle(area: string) {
    setLoading(true);
    setLog(null);
    const r = await fetch("/api/battle", {
      method: "POST",
      body: JSON.stringify({ area }),
    });
    const data = await r.json();
    setLoading(false);
    setLog(data);
  }

  return (
    <main className="container">
      <h1>Arena</h1>

      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <button className="btn" disabled={loading} onClick={() => startBattle("creep")}>Creeps</button>
        <button className="btn" disabled={loading} onClick={() => startBattle("jungle")}>Jungle</button>
        <button className="btn" disabled={loading} onClick={() => startBattle("ancient")}>Ancient</button>
        <button className="btn" disabled={loading} onClick={() => startBattle("boss")}>Boss</button>
      </div>

      {loading && <p>Combatendo...</p>}

      {log && (
        <div className="card" style={{whiteSpace:'pre-wrap'}}>
          <h3>Resultado: {log.result === "win" ? "Vitória" : "Derrota"}</h3>
          <p>Inimigo: {log.enemy.name} (Lv {log.enemy.level})</p>
          <hr/>
          {log.log.map((l: any, idx: number) => (
            <p key={idx}>
              {l.description} (HP alvo: {l.target_hp_after})
            </p>
          ))}
        </div>
      )}
    </main>
  );
}
