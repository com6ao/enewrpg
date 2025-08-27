"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import InventoryPanel from "@/app/components/InventoryPanel";
import ProgressBar from "@/app/components/ProgressBar";
import type { Attr as Attrs } from "@/lib/formulas";
import {
  meleeAttack,
  rangedAttack,
  magicAttack,
  resistByKind,
  bestBasic,
  estimateDamage,
  accuracyFinal,
} from "@/lib/formulas";

/* ===== tipos visíveis na UI ===== */
type Log = { text: string; side: "neutral" | "player" | "enemy" };
type Calc = { text: string; side: "player" | "enemy" };
type UnitPub = { name: string; level: number; hp: number; hpMax: number; mp: number; mpMax: number; atb: number; nextIcon?: string };
type Snap = {
  player: UnitPub;
  enemy: UnitPub;
  log: Log[];
  calc: Calc[];
  srv: { player: { attrs: Attrs; level: number }; enemy: { attrs: Attrs; level: number }; stage: number; gold: number };
};
type StartResp = { id: string; snap: Snap; gold: number };
type StepResp = {
  id: string;
  snap: Snap;
  lines: Log[];
  status: "active" | "finished";
  winner: null | "player" | "enemy" | "draw";
  cursor: number;
  rewards: { gold: number | null; xp: number; drops: any[] };
};


/* UI base compacta */
const card: React.CSSProperties = { background: "#0b0b0b", border: "1px solid #1e1e1e", borderRadius: 10, padding: 8 };
const stageName = (s: number) => (s === 1 ? "Rato Selvagem" : s === 2 ? "Lobo Faminto" : s === 3 ? "Goblin Batedor" : `Elite ${s}`);

export default function ArenaPage() {
  const [arenaId, setArenaId] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snap | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [showCalc, setShowCalc] = useState(false);
  const [auto, setAuto] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadingStep, setLoadingStep] = useState(false);
  const [ended, setEnded] = useState<null | "player" | "enemy" | "draw">(null);
  const [progMin, setProgMin] = useState(false);
  const [bagOpen, setBagOpen] = useState(false);
  const [gold, setGold] = useState(0);

  const restoredRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const aid = localStorage.getItem("arena:arenaId");
    const snapStr = localStorage.getItem("arena:snap");
    const logsStr = localStorage.getItem("arena:logs");
    const autoStr = localStorage.getItem("arena:auto");
    const goldStr = localStorage.getItem("arena:gold");
    if (autoStr !== null) setAuto(autoStr === "true");
    if (goldStr) setGold(parseInt(goldStr));
    if (aid && snapStr && logsStr) {
      try {
        setArenaId(aid);
        setSnap(JSON.parse(snapStr));
        setLogs(JSON.parse(logsStr));
        restoredRef.current = true;
      } catch (err) {
        console.error(err);
      }
    }
  }, []);

  useEffect(() => {
    if (restoredRef.current && arenaId && !ended) {
      restoredRef.current = false;
      loop(arenaId);
    }
  }, [arenaId, ended, auto]);



  useEffect(() => {
    document.body.classList.add("arena-page");
    return () => document.body.classList.remove("arena-page");
  }, []);

  const [pSlash, setPSlash] = useState(false);
  const [eSlash, setESlash] = useState(false);
  const prevHpRef = useRef<{ p: number; e: number } | null>(null);
  const battleRef = useRef<HTMLDivElement>(null);
  const calcRef = useRef<HTMLDivElement>(null);

  type Cmd =
    | { kind: "basic" }
    | { kind: "skill"; id: "golpe_poderoso" | "explosao_arcana" | "tiro_preciso" }
    | { kind: "buff"; id: "foco" | "fortalecer" | "enfraquecer" };
  const pendingCmd = useRef<Cmd | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    },
    []
  );

  useEffect(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (auto && arenaId && !ended) loop(arenaId);
  }, [auto, arenaId, ended]);

  async function stepOnce(id: string) {
    const cmd = pendingCmd.current;
    pendingCmd.current = null;
    setLoadingStep(true);
    try {
      const r = await fetch("/api/arena", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "step", id, cmd }) });
      if (!r.ok) {
        setArenaId(null);
        setSnap(null);
        setLogs([]);
        if (typeof window !== "undefined") {
          for (const k of Object.keys(localStorage)) if (k.startsWith("arena:")) localStorage.removeItem(k);
          alert("Sessão expirada. Inicie uma nova batalha.");
        }
        return null;
      }
      return (await r.json()) as StepResp;
    } finally {
      setLoadingStep(false);
    }
  }
  async function loop(id: string) {
    if (ended) return;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (!auto && !pendingCmd.current) return;
    const res = await stepOnce(id);
    if (!res) return;
    if (res.lines?.length) setLogs((p) => [...p, ...res.lines]);
    setSnap(res.snap);
    if (res.rewards?.gold !== null && res.rewards?.gold !== undefined) setGold(res.rewards.gold);
    if (res.status === "finished") {
      setEnded(res.winner);
      return;
    }
    timer.current = setTimeout(() => loop(id), 450);
  }
  async function start() {
    setBusy(true);
    setEnded(null);
    setLogs([]);
    setArenaId(null);
    setSnap(null);
    pendingCmd.current = null;
    try {
      const r = await fetch("/api/arena", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "start" }) });
      if (!r.ok) {
        alert(await r.text());
        return;
      }
      const data = (await r.json()) as StartResp;
      setArenaId(data.id);
      setSnap(data.snap);
      setGold(data.gold ?? 0);
      if (typeof window !== "undefined") loop(data.id);
    } finally {
      setBusy(false);
    }
  }
  const queue = (c: Cmd) => {
    pendingCmd.current = c;
  if (!auto && arenaId && !timer.current && !loadingStep) loop(arenaId);
  };

  useEffect(() => {
    if (battleRef.current) battleRef.current.scrollTop = battleRef.current.scrollHeight;
  }, [logs, snap?.log]);
  useEffect(() => {
    if (calcRef.current) calcRef.current.scrollTop = calcRef.current.scrollHeight;
  }, [showCalc, snap?.calc]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (arenaId) localStorage.setItem("arena:arenaId", arenaId);
    else {
      localStorage.removeItem("arena:arenaId");
    }
  }, [arenaId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (snap) localStorage.setItem("arena:snap", JSON.stringify(snap));
    else localStorage.removeItem("arena:snap");
  }, [snap]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (logs.length) localStorage.setItem("arena:logs", JSON.stringify(logs));
    else localStorage.removeItem("arena:logs");
  }, [logs]);
  
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("arena:gold", gold.toString());
  }, [gold]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("arena:auto", String(auto));
  }, [auto]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (ended) {
      localStorage.removeItem("arena:arenaId");
      localStorage.removeItem("arena:snap");
      localStorage.removeItem("arena:logs");
      localStorage.removeItem("arena:auto");
    }
  }, [ended]);

  useEffect(() => {
    if (!snap) return;
    const cur = { p: snap.player.hp, e: snap.enemy.hp };
    if (prevHpRef.current) {
      if (cur.p < prevHpRef.current.p) {
        setPSlash(true);
        setTimeout(() => setPSlash(false), 380);
      }
      if (cur.e < prevHpRef.current.e) {
        setESlash(true);
        setTimeout(() => setESlash(false), 380);
      }
    }
    prevHpRef.current = cur;
  }, [snap?.player.hp, snap?.enemy.hp]);

  const accPlayer = snap ? accuracyFinal(snap.player.level, snap.enemy.level, snap.srv.enemy.attrs) : null;
  const accEnemy = snap ? accuracyFinal(snap.enemy.level, snap.player.level, snap.srv.player.attrs) : null;

  function decorate(text: string, side: "neutral" | "player" | "enemy") {
    let t = text
      .replace(/\(crit\)/gi, "(crit) 💥")
      .replace(/\btrue[- ]?dano:? ?sim\b/gi, "true:sim ☀️")
      .replace(/\bredução de dano acionada\b/gi, "redução de dano acionada 🌙");
    let color = "#e5e7eb";
    if (/erra|erro|miss/i.test(t)) color = "#f6c453";
    else if (/esquiv|dodge/i.test(t)) color = "#60a5fa";
    else if (side === "player") color = "#22c55e";
    else if (side === "enemy") color = "#ef4444";
    t = t.replace(/\b(\d+)\b/g, (m) => `<b>${m}</b>`);
    return { __html: t, color };
  }

  const stage = snap?.srv?.stage ?? 1;
  const lastStage = Math.max(stage + 4, 7);

  const turnTrail = useMemo(() => {
    if (!snap) return [];
    const pSpd = snap.srv.player.attrs.dex + snap.srv.player.attrs.wis;
    const eSpd = snap.srv.enemy.attrs.dex + snap.srv.enemy.attrs.wis;
    const seq: ("player" | "enemy")[] = [];
    let p = 0,
      e = 0;
    for (let i = 0; i < 10; i++) {
      if (p <= e) {
        seq.push("player");
        p += Math.max(1, 1000 / (pSpd + 1));
      } else {
        seq.push("enemy");
        e += Math.max(1, 1000 / (eSpd + 1));
      }
    }
    return seq;
  }, [snap?.srv.player.attrs, snap?.srv.enemy.attrs, snap?.player?.hp, snap?.enemy?.hp]);

  const skillMeta = useMemo(() => {
    if (!snap) return null;
    const A = snap.srv.player.attrs,
      D = snap.srv.enemy.attrs,
      acc = accPlayer ?? 0;
    const basic = (() => {
      const best = bestBasic(A);
      const res = resistByKind(D, best.kind);
      return { label: "Ataque básico", dmg: estimateDamage(best.base, res), acc, mp: 0, stat: "—" };
    })();
    const golpe = (() => {
      const base = Math.floor(meleeAttack(A) * 1.3);
      const res = resistByKind(D, "melee");
      return { label: "Golpe Poderoso", dmg: estimateDamage(base, res), acc, mp: 10, stat: "STR" };
    })();
    const arcana = (() => {
      const base = Math.floor(magicAttack(A) * 1.5);
      const res = resistByKind(D, "magic");
      return { label: "Explosão Arcana", dmg: estimateDamage(base, res), acc, mp: 12, stat: "INT" };
    })();
    const tiro = (() => {
      const base = Math.floor(rangedAttack(A) * 1.4);
      const res = resistByKind(D, "ranged");
      return { label: "Tiro Preciso", dmg: estimateDamage(base, res), acc, mp: 8, stat: "DEX" };
    })();
    return { basic, golpe, arcana, tiro };
  }, [snap, accPlayer]);

  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: 12, position: "relative" }}>
      {(busy || loadingStep) && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.25)", backdropFilter: "blur(1px)", display: "grid", placeItems: "center", zIndex: 60 }}>
          <div style={{ ...card, padding: 8, display: "inline-flex", gap: 8, alignItems: "center", fontSize: 12 }}>
            <Spinner small />
            <span>Processando…</span>
          </div>
        </div>
      )}

      {/* Modal Mochila */}
      {bagOpen && (
        <div role="dialog" aria-modal="true" onClick={() => setBagOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "center", zIndex: 70 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: "min(740px,92vw)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <strong style={{ fontSize: 14 }}>Mochila</strong>
              <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 11 }}>
                <span>
                  💰 <b>{gold}</b>
                </span>
                <button onClick={() => setBagOpen(false)} style={{ padding: "4px 8px", borderRadius: 8, background: "#1f2937", fontSize: 11 }}>
                  Fechar
                </button>
              </div>
            </div>
            <InventoryPanel mode="modal" />
          </div>
        </div>
      )}

      {/* GRID compacto */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "240px 1fr 240px",
          gridTemplateAreas: `
          "actions fighters progress"
          "actions turns   progress"
          "actions attrs   progress"
          "actions log     progress"
          "actions calc    progress"
        `,
          gap: 12,
        }}
      >
        {/* Centro: header + lutadores */}
        <div style={{ gridArea: "fighters" }}>
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <h1 style={{ fontSize: 18, margin: 0 }}>Arena</h1>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={() => setBagOpen(true)} title="Mochila" style={{ padding: "4px 8px", borderRadius: 8, background: "#1f2937", fontSize: 11 }}>
                🎒 Mochila
              </button>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto
              </label>
              <div style={{ display: "grid", gap: 2, justifyItems: "end" }}>
                <button onClick={start} disabled={busy} style={{ padding: "6px 10px", borderRadius: 8, background: "#2ecc71", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                  {busy && <Spinner small />}
                  Lutar
                </button>
                <span style={{ fontSize: 10, opacity: 0.8 }}>Se travar, aguarde 5s e clique novamente.</span>
              </div>
            </div>
          </header>

          {snap && (
            <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 6 }}>
              <FighterCard you snap={snap} slash={pSlash} />
              <FighterCard snap={snap} slash={eSlash} />
            </section>
          )}
        </div>

        {/* AÇÕES — compactas */}
        {arenaId && snap && skillMeta && (
          <section style={{ ...card, gridArea: "actions", display: "grid", gap: 6, alignSelf: "start" }}>
            <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
              Suas ações {loadingStep && <Spinner small />}
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <ActionBtn onClick={() => queue({ kind: "basic" })} label="Ataque básico" meta={`DMG≈${skillMeta.basic.dmg} • ACC≈${skillMeta.basic.acc}% • MP ${skillMeta.basic.mp}`} disabled={loadingStep} loading={loadingStep} />
              <ActionBtn onClick={() => queue({ kind: "skill", id: "golpe_poderoso" })} label="Golpe Poderoso" meta={`DMG≈${skillMeta.golpe.dmg} • ACC≈${skillMeta.golpe.acc}% • MP ${skillMeta.golpe.mp} • ${skillMeta.golpe.stat}`} disabled={loadingStep} loading={loadingStep} />
              <ActionBtn onClick={() => queue({ kind: "skill", id: "explosao_arcana" })} label="Explosão Arcana" meta={`DMG≈${skillMeta.arcana.dmg} • ACC≈${skillMeta.arcana.acc}% • MP ${skillMeta.arcana.mp} • ${skillMeta.arcana.stat}`} disabled={loadingStep} loading={loadingStep} />
              <ActionBtn onClick={() => queue({ kind: "skill", id: "tiro_preciso" })} label="Tiro Preciso" meta={`DMG≈${skillMeta.tiro.dmg} • ACC≈${skillMeta.tiro.acc}% • MP ${skillMeta.tiro.mp} • ${skillMeta.tiro.stat}`} disabled={loadingStep} loading={loadingStep} />
              <ActionBtn onClick={() => queue({ kind: "buff", id: "foco" })} label="Foco" meta="+ACERTO por 2T" disabled={loadingStep} loading={loadingStep} />
              <ActionBtn onClick={() => queue({ kind: "buff", id: "fortalecer" })} label="Fortalecer" meta="+DANO por 2T" disabled={loadingStep} loading={loadingStep} />
              <ActionBtn onClick={() => queue({ kind: "buff", id: "enfraquecer" })} label="Enfraquecer" meta="-RESIST do alvo por 2T" disabled={loadingStep} loading={loadingStep} />
            </div>
            <div style={{ fontSize: 10, opacity: 0.8 }}>Se houver lag, o indicador permanece visível.</div>
          </section>
        )}

        {/* PROGRESSO — direita */}
        <aside style={{ ...card, gridArea: "progress", position: "sticky", top: 10, height: "fit-content" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h3 style={{ marginBottom: 4, fontWeight: 600, fontSize: 12 }}>Progresso da Arena</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10 }}>
              <div>
                💰 <b>{gold}</b>
              </div>
              <button onClick={() => setProgMin((v) => !v)} style={{ padding: "2px 6px", background: "#1f2937", borderRadius: 6, fontSize: 10 }}>
                {progMin ? "Expandir" : "Minimizar"}
              </button>
            </div>
          </div>

          {!progMin && snap && (
            <>
              <div style={{ fontSize: 10, marginBottom: 6 }}>
                Estágio atual: <b>{stage}</b>
              </div>
              <div style={{ border: "1px solid #1e1e1e", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 62px", background: "#111", padding: "4px 6px", fontWeight: 600, fontSize: 10 }}>
                  <div>Est.</div>
                  <div>Inimigo</div>
                  <div style={{ textAlign: "right" }}>Status</div>
                </div>
                {Array.from({ length: lastStage }, (_, i) => i + 1).map((s) => {
                  const isPast = s < stage;
                  const isCurrent = s === stage;
                  const hpPct = isCurrent && snap ? Math.round((snap.enemy.hp / snap.enemy.hpMax) * 100) : null;
                  return (
                    <div key={s} style={{ display: "grid", gridTemplateColumns: "40px 1fr 62px", padding: "4px 6px", borderTop: "1px solid #151515", alignItems: "center", fontSize: 10 }}>
                      <div>#{s}</div>
                      <div>{stageName(s)}</div>
                      <div style={{ textAlign: "right" }}>{isPast ? "✔" : isCurrent ? `${hpPct}%` : "—"}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </aside>

        {/* ORDEM DE TURNOS */}
        {snap && (
          <section style={{ gridArea: "turns" }}>
            <div style={{ fontSize: 11, opacity: 0.9, marginBottom: 4 }}>Ordem de turnos</div>
            <div
              style={{
                position: "relative",
                height: 34,
                borderRadius: 8,
                background: "linear-gradient(180deg,#0e0e0e,#0b0b0b)",
                border: "1px solid #1a1a1a",
                display: "flex",
                alignItems: "center",
                padding: "0 8px",
                gap: 8,
                overflowX: "auto",
              }}
            >
              {turnTrail.map((who, i) => (
                <div
                  key={i}
                  title={who === "player" ? "Você" : snap.enemy.name}
                  style={{
                    minWidth: 30,
                    height: 20,
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: who === "player" ? "rgba(46,204,113,.15)" : "rgba(239,68,68,.15)",
                    border: `1px solid ${who === "player" ? "rgba(46,204,113,.4)" : "rgba(239,68,68,.4)"}`,
                  }}
                >
                  <span style={{ fontSize: 12 }}>{who === "player" ? "👑" : "👹"}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ATRIBUTOS */}
        {snap && (
          <section style={{ gridArea: "attrs", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <strong style={{ fontSize: 12 }}>Seus atributos</strong>
                <div style={{ width: 90 }}>
                  <ProgressBar value={0} color="#29b6f6" />
                </div>
              </div>
              <AttrGrid a={snap.srv.player.attrs} b={snap.srv.enemy.attrs} level={snap.player.level} accShown={accPlayer} />
            </div>
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <strong style={{ fontSize: 12 }}>Atributos do inimigo</strong>
                <span style={{ fontSize: 11, opacity: 0.9 }}>Lv {snap.enemy.level}</span>
              </div>
              <AttrGrid a={snap.srv.enemy.attrs} b={snap.srv.player.attrs} level={snap.enemy.level} accShown={accEnemy} />
            </div>
          </section>
        )}

        {/* LOG DE COMBATE */}
        <section style={{ gridArea: "log" }}>
          <div ref={battleRef} style={{ ...card, maxHeight: 220, padding: 8, overflow: "auto", fontSize: 11 }}>
            {(logs.length ? logs : snap?.log ?? []).map((l, i) => {
              const d = decorate(l.text, l.side);
              return <div key={i} style={{ padding: "4px 3px", borderBottom: "1px solid #151515", color: d.color as string }} dangerouslySetInnerHTML={{ __html: d.__html }} />;
            })}
          </div>
        </section>

        {/* CÁLCULOS */}
        <section style={{ gridArea: "calc" }}>
          <aside style={{ ...card, padding: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ marginBottom: 4, fontWeight: 600, fontSize: 12 }}>Cálculos</h3>
              <button onClick={() => setShowCalc((v) => !v)} style={{ padding: "3px 6px", borderRadius: 6, background: "#1f2937", fontSize: 11 }}>
                {showCalc ? "Ocultar" : "Ver"}
              </button>
            </div>
            {showCalc ? (
              <div ref={calcRef} style={{ fontSize: 11, maxHeight: 160, overflow: "auto" }}>
                {(snap?.calc ?? []).map((c, i) => (
                  <div key={i} style={{ borderBottom: "1px solid #151515", padding: "3px 2px" }}>
                    {c.text}
                  </div>
                ))}
              </div>
            ) : (
              <div className="muted" style={{ fontSize: 11 }}>
                Clique em “Ver” para exibir cálculos.
              </div>
            )}
          </aside>
        </section>
      </div>

      {ended && (
        <div style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ opacity: 0.9, fontSize: 11 }}>Resultado: {ended === "draw" ? "empate" : ended === "player" ? "você venceu" : "você perdeu"}</div>
          {ended === "player" && arenaId && !auto && (
            <button onClick={() => loop(arenaId)} style={{ padding: "6px 10px", borderRadius: 8, background: "#2ecc71", fontSize: 11 }}>
              Próximo estágio
            </button>
          )}
        </div>
      )}
    </main>
  );
}

/* ==== Auxiliares ==== */
function FighterCard({ you = false, snap, slash }: { you?: boolean; snap: Snap; slash: boolean }) {
  const unit = you ? snap.player : snap.enemy;
  const bg = you ? "#1f6feb" : "#ef4444";
  return (
    <div style={{ ...card, position: "relative" }}>
      <div style={{ position: "absolute", left: -6, top: -6, width: 46, height: 46, borderRadius: 9999, background: bg, display: "grid", placeItems: "center", boxShadow: `0 0 8px ${you ? "rgba(31,111,235,.55)" : "rgba(239,68,68,.55)"}` }}>
        <span style={{ fontSize: 18, color: "#fff" }}>{you ? "🛡️" : "👹"}</span>
      </div>
      {slash && <SlashFX />}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, paddingLeft: 50, fontSize: 12 }}>
        <strong>{you ? "Você" : unit.name}</strong>
        <span>Lv {unit.level}</span>
      </div>
      <div style={{ fontSize: 10, opacity: 0.85, marginBottom: 3, paddingLeft: 50 }}>
        HP {unit.hp}/{unit.hpMax}
      </div>
      <ProgressBar value={(unit.hp / unit.hpMax) * 100} color="#2ecc71" />
      <div style={{ fontSize: 10, opacity: 0.85, margin: "6px 0 3px", paddingLeft: 50 }}>
        MP {unit.mp}/{unit.mpMax}
      </div>
      <ProgressBar value={(unit.mp / unit.mpMax) * 100} color="#8a63d2" />
    </div>
  );
}
function AttrGrid({ a, b, level, accShown }: { a: Attrs; b: Attrs; level: number; accShown?: number | null }) {
  const arrow = (x: number, y: number) => {
    const d = x - y;
    const s = d >= 10 ? "↑↑↑" : d >= 5 ? "↑↑" : d > 0 ? "↑" : d <= -10 ? "↓↓↓" : d <= -5 ? "↓↓" : d < 0 ? "↓" : "";
    const c = d > 0 ? "#2ecc71" : d < 0 ? "#e74c3c" : "#9aa0a6";
    return <span style={{ marginLeft: 4, fontSize: 10, color: c }}>{s}</span>;
  };
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 4, fontSize: 11 }}>
        <div>
          STR {a.str}
          {arrow(a.str, b.str)}
        </div>
        <div>
          DEX {a.dex}
          {arrow(a.dex, b.dex)}
        </div>
        <div>
          INT {a.intt}
          {arrow(a.intt, b.intt)}
        </div>
        <div>
          WIS {a.wis}
          {arrow(a.wis, b.wis)}
        </div>
        <div>
          CHA {a.cha}
          {arrow(a.cha, b.cha)}
        </div>
        <div>
          CON {a.con}
          {arrow(a.con, b.con)}
        </div>
        <div>
          LUCK {a.luck}
          {arrow(a.luck, b.luck)}
        </div>
      </div>
      {typeof accShown === "number" && (
        <div style={{ marginTop: 6, fontSize: 11, opacity: 0.9 }}>
          Precisão efetiva: <b>{accShown}%</b>
        </div>
      )}
    </>
  );
}
function ActionBtn({ onClick, label, meta, disabled, loading }: { onClick: () => void; label: string; meta?: string; disabled?: boolean; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "6px 8px",
        background: "#1f2937",
        borderRadius: 8,
        fontSize: 11,
        lineHeight: 1,
        opacity: disabled ? 0.7 : 1,
        display: "inline-flex",
        gap: 6,
        alignItems: "center",
        border: "1px solid #222",
      }}
    >
      {loading && <Spinner small />}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        {meta && <span style={{ fontSize: 10, opacity: 0.9 }}>{meta}</span>}
      </div>
    </button>
  );
}
function SlashFX() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.style.opacity = "0";
      el.style.transform = "translate(-10px,-10px) rotate(-24deg) scale(1.05)";
    });
  }, []);
  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: -16,
        top: -16,
        width: 84,
        height: 84,
        pointerEvents: "none",
        opacity: 0.95,
        transform: "translate(0,0) rotate(-24deg) scale(1)",
        transition: "transform 360ms ease, opacity 360ms ease",
        background: "linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.95) 50%,rgba(255,255,255,0) 100%)",
        filter: "drop-shadow(0 0 6px rgba(255,255,255,.7))",
        maskImage: "linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(0,0,0,1) 35%,rgba(0,0,0,1) 65%,rgba(0,0,0,0) 100%)",
        WebkitMaskImage: "linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(0,0,0,1) 35%,rgba(0,0,0,1) 65%,rgba(0,0,0,0) 100%)",
      }}
    />
  );
}
function Spinner({ small = false }: { small?: boolean }) {
  const s = small ? 14 : 18;
  return (
    <svg width={s} height={s} viewBox="0 0 50 50" aria-label="carregando">
      <circle cx="25" cy="25" r="20" stroke="rgba(255,255,255,.25)" strokeWidth="5" fill="none" />
      <circle cx="25" cy="25" r="20" stroke="#fff" strokeWidth="5" strokeLinecap="round" fill="none" strokeDasharray="90 150">
        <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="0.8s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}
