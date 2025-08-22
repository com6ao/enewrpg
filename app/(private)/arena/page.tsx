"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Attr = { str: number; dex: number; intt: number; wis: number; cha: number; con: number; luck: number };
type UnitPublic = {
  id: "player" | "enemy";
  name: string;
  level: number;
  hp: number;
  hpMax: number;
  mp: number;
  mpMax: number;
  atb: number; // 0..100
  nextIcon?: string;
};
type Log = { text: string; side: "neutral" | "player" | "enemy" };
type Calc = { text: string; side: "player" | "enemy" };

type ArenaState = {
  player: UnitPublic;
  enemy: UnitPublic;
  log: Log[];
  calc: Calc[];
  // payload opaca de servidor
  srv: any;
};

type CmdKind = "basic" | "skill" | "buff";
type Cmd = { kind: CmdKind; id?: string };

export default function ArenaPage() {
  const [state, setState] = useState<ArenaState | null>(null);
  const [auto, setAuto] = useState(true);
  const [openSkills, setOpenSkills] = useState(false);
  const [openBuffs, setOpenBuffs] = useState(false);
  const timer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    boot();
    return () => timer.current && clearTimeout(timer.current);
  }, []);

  async function boot() {
    const r = await fetch("/api/arena", { method: "POST", body: JSON.stringify({ op: "start" }) });
    const data = await r.json();
    setState(data);
  }

  async function step(cmd?: Cmd) {
    if (!state) return;
    const r = await fetch("/api/arena", {
      method: "POST",
      body: JSON.stringify({ op: "step", cmd, srv: state.srv }),
    });
    const data = await r.json();
    setState(data);
  }

  useEffect(() => {
    if (!auto || !state) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => step(), 400);
  }, [state, auto]);

  const skills = useMemo(
    () => [
      { id: "golpe_poderoso", name: "Golpe Poderoso (STR)", mp: 10 },
      { id: "explosao_arcana", name: "Explosão Arcana (INT)", mp: 12 },
      { id: "tiro_preciso", name: "Tiro Preciso (DEX)", mp: 8 },
    ],
    []
  );

  const buffs = useMemo(
    () => [
      { id: "foco", name: "Foco (+acerto)" },
      { id: "fortalecer", name: "Fortalecer (+dano)" },
      { id: "enfraquecer", name: "Enfraquecer (-resist inimigo)" },
    ],
    []
  );

  function Bar({ value, max, color }: { value: number; max: number; color: string }) {
    const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
    return (
      <div style={{ background: "#2b2f37", height: 10, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: pct + "%", height: 10, background: color, transition: "width .2s" }} />
      </div>
    );
  }

  function UnitCard({ u, align }: { u: UnitPublic; align: "left" | "right" }) {
    return (
      <div style={{ display: "grid", gap: 6, textAlign: align === "left" ? "left" : "right" }}>
        <div style={{ fontWeight: 700 }}>{u.name} • Lv {u.level}</div>
        <Bar value={u.hp} max={u.hpMax} color="#22c55e" />
        <Bar value={u.mp} max={u.mpMax} color="#3b82f6" />
        <div style={{ display: "flex", gap: 6, alignItems: "center", ...(align === "right" ? { justifyContent: "flex-end" } : {}) }}>
          <div style={{ width: 80 }}>
            <Bar value={u.atb} max={100} color="#eab308" />
          </div>
          {u.nextIcon && (
            <span style={{ fontSize: 12, opacity: 0.8, border: "1px solid #444", padding: "2px 6px", borderRadius: 6 }}>
              {u.nextIcon}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <main style={{ display: "grid", gridTemplateColumns: "280px 1fr 320px", gap: 12, padding: 12 }}>
      {/* LEFT — placeholders de equipamento/itens/loja */}
      <aside style={{ background: "#0f1116", border: "1px solid #1f2937", borderRadius: 10, padding: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Equipamentos</div>
        <div style={{ height: 120, background: "#0a0c11", borderRadius: 8, border: "1px dashed #263043" }} />
        <div style={{ fontWeight: 700, margin: "12px 0 8px" }}>Itens</div>
        <div style={{ height: 120, background: "#0a0c11", borderRadius: 8, border: "1px dashed #263043" }} />
        <div style={{ fontWeight: 700, margin: "12px 0 8px" }}>Loja</div>
        <div style={{ height: 120, background: "#0a0c11", borderRadius: 8, border: "1px dashed #263043" }} />
      </aside>

      {/* CENTER — arena e log de ações */}
      <section style={{ display: "grid", gap: 12 }}>
        {/* topo dos combatentes */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            alignItems: "center",
            background: "#0f1116",
            border: "1px solid #1f2937",
            borderRadius: 10,
            padding: 12,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: 10, alignItems: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: 10, background: "#111827", border: "1px solid #263043" }} />
            {state && <UnitCard u={state.player} align="left" />}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 72px", gap: 10, alignItems: "center" }}>
            {state && <UnitCard u={state.enemy} align="right" />}
            <div style={{ width: 72, height: 72, borderRadius: 10, background: "#111827", border: "1px solid #263043" }} />
          </div>
        </div>

        {/* comandos */}
        <div
          style={{
            display: "flex",
            gap: 8,
            background: "#0f1116",
            border: "1px solid #1f2937",
            borderRadius: 10,
            padding: 10,
            alignItems: "center",
          }}
        >
          <button className="btn" onClick={() => step({ kind: "basic" })}>Ataque básico</button>

          <div style={{ position: "relative" }}>
            <button className="btn" onClick={() => setOpenSkills((v) => !v)}>Habilidade especial</button>
            {openSkills && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: "110%",
                  background: "#0f1116",
                  border: "1px solid #1f2937",
                  borderRadius: 10,
                  padding: 8,
                  display: "grid",
                  gap: 6,
                  minWidth: 260,
                  zIndex: 5,
                }}
              >
                {skills.map((s) => (
                  <button key={s.id} className="btn" onClick={() => { setOpenSkills(false); step({ kind: "skill", id: s.id }); }}>
                    {s.name} • MP {s.mp}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ position: "relative" }}>
            <button className="btn" onClick={() => setOpenBuffs((v) => !v)}>Buffs & Debuffs</button>
            {openBuffs && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: "110%",
                  background: "#0f1116",
                  border: "1px solid #1f2937",
                  borderRadius: 10,
                  padding: 8,
                  display: "grid",
                  gap: 6,
                  minWidth: 260,
                  zIndex: 5,
                }}
              >
                {buffs.map((b) => (
                  <button key={b.id} className="btn" onClick={() => { setOpenBuffs(false); step({ kind: "buff", id: b.id }); }}>
                    {b.name} • Ação bônus
                  </button>
                ))}
              </div>
            )}
          </div>

          <label style={{ marginLeft: "auto", fontSize: 13 }}>
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto
          </label>
        </div>

        {/* feed central */}
        <div
          style={{
            background: "#0f1116",
            border: "1px solid #1f2937",
            borderRadius: 10,
            padding: 10,
            height: 260,
            overflow: "auto",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Ações</div>
          <div style={{ display: "grid", gap: 6 }}>
            {state?.log.map((l, i) => (
              <div
                key={i}
                style={{
                  padding: "6px 8px",
                  background:
                    l.side === "player"
                      ? "rgba(34,197,94,.10)"
                      : l.side === "enemy"
                      ? "rgba(239,68,68,.10)"
                      : "transparent",
                  borderLeft:
                    l.side === "player" ? "3px solid #22c55e" : l.side === "enemy" ? "3px solid #ef4444" : "3px solid #374151",
                  borderRadius: 6,
                }}
              >
                {l.text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RIGHT — cálculos */}
      <aside
        style={{
          background: "#0f1116",
          border: "1px solid #1f2937",
          borderRadius: 10,
          padding: 10,
          height: 520,
          overflow: "auto",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Detalhes do cálculo</div>
        <div style={{ display: "grid", gap: 6, fontSize: 12 }}>
          {state?.calc.map((c, i) => (
            <div
              key={i}
              style={{
                padding: "6px 8px",
                background: c.side === "player" ? "rgba(34,197,94,.06)" : "rgba(239,68,68,.06)",
                borderLeft: c.side === "player" ? "3px solid #22c55e" : "3px solid #ef4444",
                borderRadius: 6,
              }}
            >
              {c.text}
            </div>
          ))}
        </div>
      </aside>
    </main>
  );
}

/* util mínima de botão */
declare global {
  // eslint-disable-next-line no-var
  var _btn_: boolean | undefined;
}
if (!globalThis._btn_) {
  const style = document.createElement("style");
  style.innerHTML = `.btn{background:#1f2937;border:1px solid #334155;color:#e5e7eb;border-radius:8px;padding:6px 10px;cursor:pointer}
  .btn:hover{background:#273244}`;
  document.head.appendChild(style);
  globalThis._btn_ = true;
}
