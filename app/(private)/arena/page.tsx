"use client";
import { useEffect, useRef, useState } from "react";

/* ===== tipos do payload da rota /api/arena ===== */
type Log = { text: string; side: "neutral" | "player" | "enemy" };
type Calc = { text: string; side: "player" | "enemy" };
type UnitPub = {
  name: string;
  level: number;
  hp: number;
  hpMax: number;
  mp: number;
  mpMax: number;
  atb: number;         // 0..100
  nextIcon?: string;
};
type Attrs = { str:number; dex:number; intt:number; wis:number; cha:number; con:number; luck:number };
type Snap = {
  player: UnitPub;
  enemy: UnitPub;
  log: Log[];
  calc: Calc[];
  // srv está disponível; usamos só os attrs
  srv: {
    player: { attrs: Attrs; level: number };
    enemy:  { attrs: Attrs; level: number };
  } as any;
};

type StartResp = { id: string; snap: Snap };
type StepResp  = {
  id: string;
  snap: Snap;
  lines: Log[];                 // NOVOS logs desde o cursor
  status: "active" | "finished";
  winner: null | "player" | "enemy" | "draw";
  cursor: number;
};

/* ===== helpers visuais ===== */
function Bar({ value, color = "#2ecc71" }: { value: number; color?: string }) {
  const w = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div style={{ height: 10, background: "#222", borderRadius: 6, overflow: "hidden" }}>
      <div style={{ width: `${w}%`, height: "100%", background: color }} />
    </div>
  );
}

function AttrCard({
  title,
  attrs,
  compare,
  level,
}: {
  title: string;
  attrs: Attrs | null;
  compare: Attrs | null;
  level: number | null;
}) {
  function arrow(a: number, b: number) {
    const d = a - b;
    let s = "";
    if (d >= 10) s = "↑↑↑";
    else if (d >= 5) s = "↑↑";
    else if (d > 0) s = "↑";
    else if (d <= -10) s = "↓↓↓";
    else if (d <= -5) s = "↓↓";
    else if (d < 0) s = "↓";
    const c = d > 0 ? "#2ecc71" : d < 0 ? "#e74c3c" : "#9aa0a6";
    return <span style={{ marginLeft: 4, fontSize: 11, color: c }}>{s}</span>;
  }
  if (!attrs)
    return (
      <div style={card}>
        <strong>{title}</strong>
        <div className="muted">Atributos indisponíveis</div>
      </div>
    );
  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <strong>{title}</strong>
        <span className="muted">Lv {level ?? "?"}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 6, fontSize: 12 }}>
        <div>STR {attrs.str}{compare && arrow(attrs.str, compare.str)}</div>
        <div>DEX {attrs.dex}{compare && arrow(attrs.dex, compare.dex)}</div>
        <div>INT {attrs.intt}{compare && arrow(attrs.intt, compare.intt)}</div>
        <div>WIS {attrs.wis}{compare && arrow(attrs.wis, compare.wis)}</div>
        <div>CHA {attrs.cha}{compare && arrow(attrs.cha, compare.cha)}</div>
        <div>CON {attrs.con}{compare && arrow(attrs.con, compare.con)}</div>
        <div>LUCK {attrs.luck}{compare && arrow(attrs.luck, compare.luck)}</div>
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "#0b0b0b",
  border: "1px solid #1e1e1e",
  borderRadius: 12,
  padding: 12,
};

/* ===== Página ===== */
export default function ArenaPage() {
  const [arenaId, setArenaId] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snap | null>(null);

  // ÚNICA fonte de verdade de log exibido
  const [logs, setLogs] = useState<Log[]>([]);
  const [showCalc, setShowCalc] = useState(false);

  const [auto, setAuto] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ended, setEnded] = useState<null | "player" | "enemy" | "draw">(null);

  const timer = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => () => timer.current && clearTimeout(timer.current), []);

  async function start() {
    setBusy(true);
    setEnded(null);
    setLogs([]);
    setArenaId(null);
    setSnap(null);

    const r = await fetch("/api/arena", { method: "POST", body: JSON.stringify({ op: "start" }) });
    if (!r.ok) {
      alert(await r.text());
      setBusy(false);
      return;
    }
    const data = (await r.json()) as StartResp;
    setArenaId(data.id);
    setSnap(data.snap);
    setBusy(false);
    if (auto) loop(data.id);
  }

  async function stepOnce(id: string) {
    const r = await fetch("/api/arena", { method: "POST", body: JSON.stringify({ op: "step", id }) });
    if (!r.ok) return null;
    return (await r.json()) as StepResp;
  }

  async function loop(id: string) {
    if (timer.current) clearTimeout(timer.current);
    const res = await stepOnce(id);
    if (!res) return;

    // Usar SOMENTE os novos logs
    if (res.lines?.length) setLogs((p) => [...p, ...res.lines]);
    setSnap(res.snap);

    if (res.status === "finished") {
      setEnded(res.winner);
      return;
    }
    if (auto) timer.current = setTimeout(() => loop(id), 550);
  }

  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: 16, display: "grid", gap: 12 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 24 }}>Arena</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            Auto
          </label>
          <button onClick={start} disabled={busy} style={{ padding: "8px 12px", borderRadius: 8, background: "#2ecc71" }}>
            Lutar
          </button>
        </div>
      </header>

      {/* HUD superior: HP + ATB */}
      {snap && (
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <strong>Você</strong>
              <span>Lv {snap.player.level}</span>
            </div>
            <Bar value={(snap.player.hp / snap.player.hpMax) * 100} />
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>
              HP {snap.player.hp}/{snap.player.hpMax}
            </div>
            {/* ATB */}
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9 }}>Ação</div>
            <Bar value={snap.player.atb} color="#00bcd4" />
          </div>

          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <strong>{snap.enemy.name}</strong>
              <span>Lv {snap.enemy.level}</span>
            </div>
            <Bar value={(snap.enemy.hp / snap.enemy.hpMax) * 100} />
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>
              HP {snap.enemy.hp}/{snap.enemy.hpMax}
            </div>
            {/* ATB */}
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9 }}>Ação</div>
            <Bar value={snap.enemy.atb} color="#ff9800" />
          </div>
        </section>
      )}

      {/* Atributos comparados */}
      {snap && (
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <AttrCard
            title="Seus atributos"
            attrs={(snap.srv?.player?.attrs as Attrs) ?? null}
            compare={(snap.srv?.enemy?.attrs as Attrs) ?? null}
            level={snap.player.level}
          />
          <AttrCard
            title="Atributos do inimigo"
            attrs={(snap.srv?.enemy?.attrs as Attrs) ?? null}
            compare={(snap.srv?.player?.attrs as Attrs) ?? null}
            level={snap.enemy.level}
          />
        </section>
      )}

      {/* Logs + Cálculos */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 12 }}>
        <div style={{ ...card, maxHeight: 280, overflow: "auto" }}>
          {logs.map((l, i) => (
            <div key={i} style={{ padding: "6px 4px", borderBottom: "1px solid #151515" }}>
              {l.text}
            </div>
          ))}
        </div>
        <aside style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ marginBottom: 8, fontWeight: 600 }}>Cálculos</h3>
            <button
              onClick={() => setShowCalc((v) => !v)}
              style={{ padding: "6px 8px", borderRadius: 8, background: "#1f2937", fontSize: 12 }}
            >
              {showCalc ? "Ocultar" : "Ver"}
            </button>
          </div>
          {showCalc ? (
            <div style={{ fontSize: 12, maxHeight: 280, overflow: "auto" }}>
              {(snap?.calc ?? []).map((c, i) => (
                <div key={i} style={{ borderBottom: "1px solid #151515", padding: "4px 2px" }}>
                  {c.text}
                </div>
              ))}
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 12 }}>
              Clique em “Ver” para exibir cálculos aqui.
            </div>
          )}
        </aside>
      </section>

      {/* Controles */}
      {arenaId && snap && (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => loop(arenaId)}
            disabled={!arenaId || !!ended}
            style={{ padding: "8px 12px", borderRadius: 8, background: "#1f2937" }}
          >
            Próximo turno
          </button>
          {ended && (
            <div style={{ alignSelf: "center", opacity: 0.9 }}>
              Resultado: {ended === "draw" ? "empate" : ended === "player" ? "você venceu" : "você perdeu"}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
