"use client";
import { useEffect, useRef, useState } from "react";
import HPBar from "@/components/HPBar";
import { parseLog, type Event } from "@/lib/combatLog";

type Enemy = { id: string; name: string; base_hp: number; /* ...outros campos se houver */ };
type BattleResponse = {
  enemy: Enemy;
  result: { winner: "player" | "enemy" | "draw"; playerMaxHp: number; enemyMaxHp: number; playerName?: string };
  log: string[]; // já existe na sua API
};

export default function ArenaPage() {
  const [area, setArea] = useState<"creep"|"jungle"|"ancient"|"boss">("creep");
  const [state, setState] = useState<"idle"|"loading"|"playing"|"done">("idle");
  const [events, setEvents] = useState<Event[]>([]);
  const [cursor, setCursor] = useState(0);
  const [enemy, setEnemy] = useState<Enemy | null>(null);
  const [pHP, setPHP] = useState({ cur: 0, max: 0 });
  const [eHP, setEHP] = useState({ cur: 0, max: 0 });
  const [linesShown, setLinesShown] = useState<string[]>([]);
  const timer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function startBattle() {
    setState("loading");
    setEvents([]); setCursor(0); setLinesShown([]);

    const r = await fetch("/api/battle", { method: "POST", body: JSON.stringify({ area }) });
    if (!r.ok) { alert(await r.text()); setState("idle"); return; }
    const data: BattleResponse = await r.json();

    const evs = parseLog(data.log, data.result?.winner);
    setEnemy(data.enemy);
    setPHP({ cur: data.result.playerMaxHp, max: data.result.playerMaxHp });
    setEHP({ cur: data.result.enemyMaxHp,  max: data.result.enemyMaxHp });
    setEvents(evs);
    setState("playing");
    tick(0, evs, data.log);
  }

  function tick(i: number, evs: Event[], rawLines: string[]) {
    if (i >= evs.length) { setState("done"); return; }
    const ev = evs[i];

    // Atualiza HP conforme evento
    if (ev.t === "hit" || ev.t === "crit") {
      if (ev.src === "player") {
        setEHP(h => ({ ...h, cur: Math.max(0, h.cur - ev.dmg) }));
      } else {
        setPHP(h => ({ ...h, cur: Math.max(0, h.cur - ev.dmg) }));
      }
    }
    // Mostra a linha correspondente se existir
    setLinesShown(ls => {
      const nextLine = rawLines[Math.min(i, rawLines.length - 1)];
      return [...ls, nextLine ?? JSON.stringify(ev)];
    });

    const delay = ev.t === "crit" ? 900 : ev.t === "hit" ? 650 : 450;
    timer.current = setTimeout(() => {
      setCursor(i + 1);
      tick(i + 1, evs, rawLines);
    }, delay);
  }

  function reset() {
    if (timer.current) clearTimeout(timer.current);
    setState("idle"); setEvents([]); setCursor(0); setLinesShown([]);
    setEnemy(null); setPHP({cur:0,max:0}); setEHP({cur:0,max:0});
  }

  return (
    <main className="container" style={{ display: "grid", gap: 12 }}>
      <h1>Arena</h1>

      <div style={{ display: "flex", gap: 8 }}>
        {(["creep","jungle","ancient","boss"] as const).map(a => (
          <button key={a} className="btn" disabled={state==="loading"||state==="playing"} onClick={()=>setArea(a)}
            style={{ background: area===a ? "#3498db" : undefined }}>
            {a}
          </button>
        ))}
        <button className="btn" onClick={startBattle} disabled={state==="loading"||state==="playing"}>Lutar</button>
        {state!=="idle" && <button className="btn" onClick={reset}>Reset</button>}
      </div>

      {state !== "idle" && (
        <section className="card" style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <h3>Você</h3>
              <HPBar current={pHP.cur} max={pHP.max} />
            </div>
            <div>
              <h3>{enemy?.name ?? "Inimigo"}</h3>
              <HPBar current={eHP.cur} max={eHP.max} />
            </div>
          </div>

          <div className="muted">Turnos: {cursor}/{events.length}</div>

          <div className="card" style={{ maxHeight: 260, overflow: "auto", background: "#0e0e0e" }}>
            {linesShown.map((line, idx) => (
              <div key={idx} style={{ padding: 6, borderBottom: "1px solid #222" }}>{line}</div>
            ))}
          </div>

          {state === "done" && (
            <div className="card" style={{ background: "#111", padding: 12 }}>
              {pHP.cur === 0 && eHP.cur === 0 ? "Empate" : pHP.cur > 0 ? "Vitória" : "Derrota"}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
