// app/(private)/arena/page.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import HPBar from "../../components/HPBar";
import { parseLog as parseTextLog, type Event } from "@/lib/combatLog";

type Enemy = { id: string; name: string; level: number };
type BattleResponse = { enemy: Enemy; result: any; log: any[] };

// tenta extrair eventos de logs estruturados
function parseStructuredLog(items: any[], winner?: string): Event[] {
  const evs: Event[] = [];
  for (const it of items) {
    const t = (it?.t ?? it?.type ?? "").toString().toLowerCase();
    const src = (it?.src ?? it?.by ?? it?.attacker ?? "").toString().toLowerCase();
    const dmg = Number(it?.dmg ?? it?.damage ?? it?.amount ?? 0);

    if (t.includes("crit")) {
      evs.push({ t: "crit", src: src === "player" ? "player" : "enemy", dmg });
      continue;
    }
    if (t.includes("hit") || t === "attack") {
      evs.push({ t: "hit", src: src === "player" ? "player" : "enemy", dmg });
      continue;
    }
    if (t.includes("miss") || t.includes("dodge") || t === "evade") {
      evs.push({ t: "miss", src: src === "player" ? "player" : "enemy" });
      continue;
    }
    // fallback neutro para manter o ritmo
    evs.push({ t: "miss", src: src === "player" ? "player" : "enemy" });
  }
  if (winner) {
    const w =
      winner === "player" || /vit[oó]ria/i.test(winner) ? "player" :
      winner === "enemy"  || /derrota/i.test(winner) ? "enemy"  : "draw";
    evs.push({ t: "end", winner: w });
  }
  return evs;
}

// escolhe o parser certo
function toEvents(log: any[], winner?: string): { events: Event[]; lines: string[] } {
  const isObj = Array.isArray(log) && log.some(x => typeof x === "object");
  if (isObj) {
    const lines = log.map((x: any) => typeof x?.text === "string" ? x.text : JSON.stringify(x));
    return { events: parseStructuredLog(log, winner), lines };
  } else {
    const lines = (log ?? []).map((x: any) => String(x));
    return { events: parseTextLog(lines, winner), lines };
  }
}

export default function ArenaPage() {
  const [area, setArea] = useState<"creep" | "jungle" | "ancient" | "boss">("creep");
  const [state, setState] = useState<"idle" | "loading" | "playing" | "done">("idle");
  const [auto, setAuto] = useState(true);

  const [enemy, setEnemy] = useState<Enemy | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [cursor, setCursor] = useState(0);
  const [linesAll, setLinesAll] = useState<string[]>([]);
  const [linesShown, setLinesShown] = useState<string[]>([]);

  const [pHP, setPHP] = useState({ cur: 0, max: 0 });
  const [eHP, setEHP] = useState({ cur: 0, max: 0 });

  const timer = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function startBattle() {
    setState("loading");
    setEvents([]); setCursor(0); setLinesShown([]); setLinesAll([]);
    if (timer.current) clearTimeout(timer.current);

    const r = await fetch("/api/battle", { method: "POST", body: JSON.stringify({ area }) });
    if (!r.ok) { alert(await r.text()); setState("idle"); return; }
    const data: BattleResponse = await r.json();

    console.debug("BATTLE RESPONSE:", data);

    const playerMax = data.result?.playerMaxHp ?? data.result?.player?.hpMax ?? data.result?.player_hp_max ?? 100;
    const enemyMax  = data.result?.enemyMaxHp  ?? data.result?.enemy?.hpMax  ?? data.result?.enemy_hp_max  ?? 100;

    setPHP({ cur: playerMax, max: playerMax });
    setEHP({ cur: enemyMax,  max: enemyMax });
    setEnemy(data.enemy);

    const winner = data.result?.winner ?? data.result?.outcome ?? data.result?.victory ?? undefined;
    const { events: evs, lines } = toEvents(data.log ?? [], winner);

    console.debug("PARSED EVENTS:", evs);
    setEvents(evs);
    setLinesAll(lines);
    setState("playing");
    if (auto) tick(0, evs, lines);
  }

  function tick(i: number, evs: Event[], rawLines: string[]) {
    if (i >= evs.length) { setState("done"); return; }
    const ev = evs[i];

    if (ev.t === "hit" || ev.t === "crit") {
      if (ev.src === "player") setEHP(h => ({ ...h, cur: Math.max(0, h.cur - (ev as any).dmg) }));
      else setPHP(h => ({ ...h, cur: Math.max(0, h.cur - (ev as any).dmg) }));
    }

    setLinesShown(ls => [...ls, rawLines[Math.min(i, rawLines.length - 1)] ?? JSON.stringify(ev)]);

    const delay = ev.t === "crit" ? 900 : ev.t === "hit" ? 650 : 450;
    const next = () => { setCursor(i + 1); if (auto) tick(i + 1, evs, rawLines); };
    if (auto) {
      timer.current = setTimeout(next, delay);
    }
  }

  // próximo turno manual
  function nextTurn() {
    if (state !== "playing" || auto) return;
    tick(cursor, events, linesAll);
  }

  function reset() {
    if (timer.current) clearTimeout(timer.current);
    setState("idle"); setEvents([]); setCursor(0); setLinesShown([]); setLinesAll([]);
    setEnemy(null); setPHP({ cur: 0, max: 0 }); setEHP({ cur: 0, max: 0 });
  }

  return (
    <main className="container" style={{ display: "grid", gap: 12 }}>
      <h1>Arena</h1>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {(["creep","jungle","ancient","boss"] as const).map(a => (
          <button
            key={a}
            className="btn"
            disabled={state === "loading" || state === "playing"}
            onClick={() => setArea(a)}
            style={{ background: area === a ? "#3498db" : undefined }}
          >
            {a}
          </button>
        ))}
        <button className="btn" onClick={startBattle} disabled={state === "loading" || state === "playing"}>Lutar</button>
        {state !== "idle" && <button className="btn" onClick={reset}>Reset</button>}

        {/* controle de reprodução */}
        <label style={{ marginLeft: 12, display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={auto}
            onChange={e => { setAuto(e.target.checked); if (e.target.checked && state==="playing") tick(cursor, events, linesAll); }} />
          Auto
        </label>
        {!auto && state === "playing" && (
          <button className="btn" onClick={nextTurn}>Próximo turno</button>
        )}
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
