"use client";
import { useEffect, useRef, useState } from "react";

/* ===== tipos ===== */
type Log = { text: string; side: "neutral" | "player" | "enemy" };
type Calc = { text: string; side: "player" | "enemy" };
type UnitPub = { name: string; level: number; hp: number; hpMax: number; mp: number; mpMax: number; atb: number; nextIcon?: string };
type Attrs = { str: number; dex: number; intt: number; wis: number; cha: number; con: number; luck: number };
type Snap = {
  player: UnitPub;
  enemy: UnitPub;
  log: Log[];
  calc: Calc[];
  srv: { player: { attrs: Attrs; level: number }; enemy: { attrs: Attrs; level: number } };
};
type StartResp = { id: string; snap: Snap };
type StepResp = { id: string; snap: Snap; lines: Log[]; status: "active" | "finished"; winner: null | "player" | "enemy" | "draw"; cursor: number };

/* ===== fórmulas mínimas p/ UI (precisão exibida) ===== */
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const dodgeChance = (a: Attrs) => clamp(Math.floor(a.dex * 1.5), 0, 95);
const accuracyPercent = (atkLv: number, defLv: number, atkMax: number, defMax: number) => {
  let acc = 100;
  if (defLv > atkLv) acc -= (defLv - atkLv) * 5;
  if (defMax > atkMax) acc -= (defMax - atkMax) * 2;
  return clamp(acc, 5, 100);
};
const finalAcc = (att: { level: number; hpMax: number }, def: { level: number; hpMax: number; attrs: Attrs }) => {
  const base = accuracyPercent(att.level, def.level, att.hpMax, def.hpMax);
  return clamp(base - dodgeChance(def.attrs), 5, 100);
};

/* ===== UI helpers ===== */
function Bar({ value, color = "#2ecc71" }: { value: number; color?: string }) {
  const w = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div style={{ height: 10, background: "#222", borderRadius: 6, overflow: "hidden" }}>
      <div style={{ width: `${w}%`, height: "100%", background: color }} />
    </div>
  );
}

const card: React.CSSProperties = { background: "#0b0b0b", border: "1px solid #1e1e1e", borderRadius: 12, padding: 12 };

function AttrCard({
  title,
  attrs,
  compare,
  level,
  accShown,
}: {
  title: string;
  attrs: Attrs | null;
  compare: Attrs | null;
  level: number | null;
  accShown?: number | null;
}) {
  const arrow = (a: number, b: number) => {
    const d = a - b;
    const s = d >= 10 ? "↑↑↑" : d >= 5 ? "↑↑" : d > 0 ? "↑" : d <= -10 ? "↓↓↓" : d <= -5 ? "↓↓" : d < 0 ? "↓" : "";
    const c = d > 0 ? "#2ecc71" : d < 0 ? "#e74c3c" : "#9aa0a6";
    return <span style={{ marginLeft: 4, fontSize: 11, color: c }}>{s}</span>;
  };
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
      {typeof accShown === "number" && (
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9 }}>
          Precisão efetiva contra o alvo: <b>{accShown}%</b>
        </div>
      )}
    </div>
  );
}

/* ===== Página ===== */
export default function ArenaPage() {
  const [arenaId, setArenaId] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snap | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [showCalc, setShowCalc] = useState(false);
  const [auto, setAuto] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ended, setEnded] = useState<null | "player" | "enemy" | "draw">(null);

  // ação pendente do jogador
  type Cmd =
    | { kind: "basic" }
    | { kind: "skill"; id: "golpe_poderoso" | "explosao_arcana" | "tiro_preciso" }
    | { kind: "buff"; id: "foco" | "fortalecer" | "enfraquecer" };
  const pendingCmd = useRef<Cmd | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function stepOnce(id: string) {
    const cmd = pendingCmd.current;
    pendingCmd.current = null;
    const r = await fetch("/api/arena", { method: "POST", body: JSON.stringify({ op: "step", id, cmd }) });
    if (!r.ok) return null;
    return (await r.json()) as StepResp;
  }

  async function loop(id: string) {
    if (timer.current) clearTimeout(timer.current);

    const res = await stepOnce(id);
    if (!res) return;

    if (res.lines?.length) setLogs(p => [...p, ...res.lines]);
    setSnap(res.snap);

    if (res.status === "finished") {
      setEnded(res.winner);
      return;
    }
    // SEMPRE continua o relógio (mesmo com Auto desmarcado)
    timer.current = setTimeout(() => loop(id), 450);
  }

  async function start() {
    setBusy(true);
    setEnded(null);
    setLogs([]);
    setArenaId(null);
    setSnap(null);
    pendingCmd.current = null;

    const r = await fetch("/api/arena", { method: "POST", body: JSON.stringify({ op: "start" }) });
    if (!r.ok) { alert(await r.text()); setBusy(false); return; }
    const data = (await r.json()) as StartResp;

    setArenaId(data.id);
    setSnap(data.snap);
    setBusy(false);

    // sempre inicia o clock
    loop(data.id);
  }

  // fila de ação do jogador
  const queue = (c: Cmd) => { pendingCmd.current = c; };

  const accPlayer = snap
    ? finalAcc(
        { level: snap.player.level, hpMax: snap.player.hpMax },
        { level: snap.enemy.level, hpMax: snap.enemy.hpMax, attrs: snap.srv.enemy.attrs }
      )
    : null;
  const accEnemy = snap
    ? finalAcc(
        { level: snap.enemy.level, hpMax: snap.enemy.hpMax },
        { level: snap.player.level, hpMax: snap.player.hpMax, attrs: snap.srv.player.attrs }
      )
    : null;

  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: 16, display: "grid", gap: 12 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 24 }}>Arena</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto
          </label>
          <button onClick={start} disabled={busy} style={{ padding: "8px 12px", borderRadius: 8, background: "#2ecc71" }}>
            Lutar
          </button>
        </div>
      </header>

      {/* HUD: HP + ATB */}
      {snap && (
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <strong>Você</strong><span>Lv {snap.player.level}</span>
            </div>
            <Bar value={(snap.player.hp / snap.player.hpMax) * 100} />
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>HP {snap.player.hp}/{snap.player.hpMax}</div>
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9 }}>Ação</div>
            <Bar value={snap.player.atb} color="#00bcd4" />
          </div>
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <strong>{snap.enemy.name}</strong><span>Lv {snap.enemy.level}</span>
            </div>
            <Bar value={(snap.enemy.hp / snap.enemy.hpMax) * 100} />
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>HP {snap.enemy.hp}/{snap.enemy.hpMax}</div>
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9 }}>Ação</div>
            <Bar value={snap.enemy.atb} color="#ff9800" />
          </div>
        </section>
      )}

      {/* Atributos + precisão efetiva */}
      {snap && (
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <AttrCard title="Seus atributos" attrs={snap.srv.player.attrs} compare={snap.srv.enemy.attrs} level={snap.player.level} accShown={accPlayer} />
          <AttrCard title="Atributos do inimigo" attrs={snap.srv.enemy.attrs} compare={snap.srv.player.attrs} level={snap.enemy.level} accShown={accEnemy} />
        </section>
      )}

      {/* Controles de AÇÃO do jogador */}
      {arenaId && snap && (
        <section style={{ ...card, display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 600 }}>Suas ações</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button onClick={() => queue({ kind: "basic" })} className="btn" style={{ padding: "8px 10px", background: "#1f2937", borderRadius: 8 }}>
              Ataque básico
            </button>
            <button onClick={() => queue({ kind: "skill", id: "golpe_poderoso" })} className="btn" style={{ padding: "8px 10px", background: "#273449", borderRadius: 8 }}>
              Golpe Poderoso
            </button>
            <button onClick={() => queue({ kind: "skill", id: "explosao_arcana" })} className="btn" style={{ padding: "8px 10px", background: "#273449", borderRadius: 8 }}>
              Explosão Arcana
            </button>
            <button onClick={() => queue({ kind: "skill", id: "tiro_preciso" })} className="btn" style={{ padding: "8px 10px", background: "#273449", borderRadius: 8 }}>
              Tiro Preciso
            </button>
            <button onClick={() => queue({ kind: "buff", id: "foco" })} className="btn" style={{ padding: "8px 10px", background: "#324157", borderRadius: 8 }}>
              Foco
            </button>
            <button onClick={() => queue({ kind: "buff", id: "fortalecer" })} className="btn" style={{ padding: "8px 10px", background: "#324157", borderRadius: 8 }}>
              Fortalecer
            </button>
            <button onClick={() => queue({ kind: "buff", id: "enfraquecer" })} className="btn" style={{ padding: "8px 10px", background: "#324157", borderRadius: 8 }}>
              Enfraquecer
            </button>
          </div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>A ação escolhida é usada automaticamente quando sua barra “Ação” atinge 100.</div>
        </section>
      )}

      {/* Logs + Cálculos */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 12 }}>
        <div style={{ ...card, maxHeight: 280, overflow: "auto" }}>
          {logs.map((l, i) => (
            <div key={i} style={{ padding: "6px 4px", borderBottom: "1px solid #151515" }}>{l.text}</div>
          ))}
        </div>
        <aside style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ marginBottom: 8, fontWeight: 600 }}>Cálculos</h3>
            <button onClick={() => setShowCalc((v) => !v)} style={{ padding: "6px 8px", borderRadius: 8, background: "#1f2937", fontSize: 12 }}>
              {showCalc ? "Ocultar" : "Ver"}
            </button>
          </div>
          {showCalc ? (
            <div style={{ fontSize: 12, maxHeight: 280, overflow: "auto" }}>
              {(snap?.calc ?? []).map((c, i) => (
                <div key={i} style={{ borderBottom: "1px solid #151515", padding: "4px 2px" }}>{c.text}</div>
              ))}
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 12 }}>Clique em “Ver” para exibir cálculos aqui.</div>
          )}
        </aside>
      </section>

      {ended && <div style={{ alignSelf: "center", opacity: 0.9 }}>Resultado: {ended === "draw" ? "empate" : ended === "player" ? "você venceu" : "você perdeu"}</div>}
    </main>
  );
}
