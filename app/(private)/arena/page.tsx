"use client";
import { useEffect, useRef, useState } from "react";
import HPBar from "../../components/HPBar";

type Battle =
  | null
  | {
      id: string;
      enemy_name: string;
      player_hp: number;
      player_hp_max: number;
      enemy_hp: number;
      enemy_hp_max: number;
      cursor: number;
      status: "active" | "finished";
      winner?: "player" | "enemy" | "draw" | null;
    };

export default function ArenaPage() {
  const [area, setArea] = useState<"creep" | "jungle" | "ancient" | "boss">("creep");
  const [state, setState] = useState<"idle" | "loading" | "playing" | "done">("idle");
  const [auto, setAuto] = useState(true);
  const [battle, setBattle] = useState<Battle>(null);
  const [lines, setLines] = useState<string[]>([]);
  const timer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function startBattle() {
    setState("loading"); setLines([]); setBattle(null);
    const r = await fetch("/api/battle/start", { method: "POST", body: JSON.stringify({ area }) });
    if (!r.ok) { alert(await r.text()); setState("idle"); return; }
    const data = await r.json();
    setBattle(data.battle);
    setState("playing");
    if (auto) stepAuto(data.battle.id);
  }

  async function actOnce(battle_id: string) {
    const r = await fetch("/api/battle/act", { method: "POST", body: JSON.stringify({ battle_id, steps: 1 }) });
    if (!r.ok) { alert(await r.text()); return null; }
    return r.json();
  }

  async function stepAuto(battle_id: string) {
    if (timer.current) clearTimeout(timer.current);
    const res = await actOnce(battle_id);
    if (!res) return;
    setBattle(res.battle);
    setLines(prev => [...prev, ...res.lines.map((x: any) => (typeof x === "string" ? x : JSON.stringify(x)))]);
    if (res.battle.status === "finished") { setState("done"); return; }
    if (auto) timer.current = setTimeout(() => stepAuto(battle_id), 550);
  }

  async function nextTurn() {
    if (!battle) return;
    const res = await actOnce(battle.id);
    if (!res) return;
    setBattle(res.battle);
    setLines(prev => [...prev, ...res.lines.map((x: any) => (typeof x === "string" ? x : JSON.stringify(x)))]);
    if (res.battle.status === "finished") setState("done");
  }

  function reset() {
    if (timer.current) clearTimeout(timer.current);
    setState("idle"); setBattle(null); setLines([]);
  }

  return (
    <main className="container" style={{ display: "grid", gap: 12 }}>
      <h1>Arena</h1>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {(["creep","jungle","ancient","boss"] as const).map(a => (
          <button key={a} className="btn" disabled={state==="loading"||state==="playing"} onClick={()=>setArea(a)}
            style={{ background: area===a ? "#3498db" : undefined }}>{a}</button>
        ))}
        <button className="btn" onClick={startBattle} disabled={state==="loading"||state==="playing"}>Lutar</button>
        {state!=="idle" && <button className="btn" onClick={reset}>Reset</button>}

        <label style={{ marginLeft: 12, display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={auto}
            onChange={e => { setAuto(e.target.checked); if (e.target.checked && battle && state==="playing") stepAuto(battle.id); }} />
          Auto
        </label>
        {!auto && state==="playing" && <button className="btn" onClick={nextTurn}>Próximo turno</button>}
      </div>

      {battle && (
        <section className="card" style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <h3>Você</h3>
              <HPBar current={battle.player_hp} max={battle.player_hp_max} />
            </div>
            <div>
              <h3>{battle.enemy_name}</h3>
              <HPBar current={battle.enemy_hp} max={battle.enemy_hp_max} />
            </div>
          </div>

          <div className="muted">
            Turnos revelados: {battle.cursor} {battle.status === "finished" ? "(finalizada)" : ""}
          </div>

          <div className="card" style={{ maxHeight: 260, overflow: "auto", background: "#0e0e0e" }}>
            {lines.map((line, i) => (
              <div key={i} style={{ padding: 6, borderBottom: "1px solid #222" }}>{line}</div>
            ))}
          </div>

          {state === "done" && (
            <div className="card" style={{ background: "#111", padding: 12 }}>
              {battle.winner === "draw" ? "Empate" : battle.winner === "player" ? "Vitória" : "Derrota"}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
