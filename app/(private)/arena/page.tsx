"use client";
import { useEffect, useMemo, useRef, useState } from "react";

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
  srv: { player: { attrs: Attrs; level: number }; enemy: { attrs: Attrs; level: number }; stage: number; gold: number };
};
type StartResp = { id: string; snap: Snap };
type StepResp = { id: string; snap: Snap; lines: Log[]; status: "active" | "finished"; winner: null | "player" | "enemy" | "draw"; cursor: number };

/* ===== fórmulas mínimas p/ UI ===== */
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const dodgeChance = (a: Attrs) => clamp(Math.floor(a.dex * 0.3), 0, 55);
const accuracyPercent = (atkLv: number, defLv: number) => {
  let acc = 100;
  if (defLv > atkLv) acc -= (defLv - atkLv) * 4;
  return clamp(acc, 5, 100);
};
const finalAcc = (att: { level: number }, def: { level: number; attrs: Attrs }) => {
  const base = accuracyPercent(att.level, def.level);
  return clamp(base - dodgeChance(def.attrs), 5, 100);
};

// mesmas fórmulas básicas da lib para estimar dano
const meleeAttack = (a: Attrs) => Math.floor(a.str * 1.8);
const rangedAttack = (a: Attrs) => a.dex + Math.floor(a.str * 0.5);
const magicAttack  = (a: Attrs) => Math.floor(a.intt * 1.8);
const mentalAttack = (a: Attrs) => a.wis;

const resistPhysicalMelee  = (a: Attrs) => a.str + Math.floor(a.dex * 0.5) + a.con;
const resistPhysicalRanged = (a: Attrs) => a.dex + Math.floor(a.str * 0.5) + a.con;
const resistMagic          = (a: Attrs) => a.intt + a.con;
const resistMental         = (a: Attrs) => a.wis + a.con;

function estBasicBase(att: Attrs) {
  const ops = [
    { base: meleeAttack(att),  kind: "melee" as const },
    { base: magicAttack(att),  kind: "magic" as const },
    { base: rangedAttack(att), kind: "ranged" as const },
    { base: mentalAttack(att), kind: "mental" as const },
  ];
  ops.sort((a,b)=>b.base-a.base);
  return ops[0];
}
function estResist(def: Attrs, kind: "melee"|"magic"|"ranged"|"mental") {
  if (kind === "melee")  return resistPhysicalMelee(def);
  if (kind === "magic")  return resistMagic(def);
  if (kind === "ranged") return resistPhysicalRanged(def);
  return resistMental(def);
}
// dano estimado sem CRIT e sem true-damage, com a mesma redução ~0.35 da resistência
function estimateDamage(base: number, defRes: number) {
  return Math.max(1, base - Math.floor(defRes * 0.35));
}

/* ==== util UI ==== */
const card: React.CSSProperties = { background: "#0b0b0b", border: "1px solid #1e1e1e", borderRadius: 12, padding: 12 };
const stageName = (s: number) =>
  s === 1 ? "Rato Selvagem" : s === 2 ? "Lobo Faminto" : s === 3 ? "Goblin Batedor" : `Elite ${s}`;

/* ===== Página ===== */
export default function ArenaPage() {
  const [arenaId, setArenaId] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snap | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [showCalc, setShowCalc] = useState(false);
  const [auto, setAuto] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ended, setEnded] = useState<null | "player" | "enemy" | "draw">(null);
  const [progMin, setProgMin] = useState(false); // minimizar progresso

  // --- FX de corte (slash) ---
  const [pSlash, setPSlash] = useState(false);
  const [eSlash, setESlash] = useState(false);
  const prevHpRef = useRef<{ p: number; e: number } | null>(null);

  // refs de autoscroll
  const battleRef = useRef<HTMLDivElement>(null);
  const calcRef = useRef<HTMLDivElement>(null);

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

  // LOOP com pausa quando Auto off e sem ação
  async function loop(id: string) {
    if (timer.current) clearTimeout(timer.current);

    if (!auto && !pendingCmd.current) {
      timer.current = setTimeout(() => loop(id), 120);
      return;
    }

    const res = await stepOnce(id);
    if (!res) return;

    if (res.lines?.length) setLogs((p) => [...p, ...res.lines]);
    setSnap(res.snap);

    if (res.status === "finished") {
      setEnded(res.winner);
      if (auto) timer.current = setTimeout(() => loop(id), 450);
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

    const r = await fetch("/api/arena", { method: "POST", body: JSON.stringify({ op: "start" }) });
    if (!r.ok) { alert(await r.text()); setBusy(false); return; }
    const data = (await r.json()) as StartResp;

    setArenaId(data.id);
    setSnap(data.snap);
    setBusy(false);
    loop(data.id);
  }

  // fila de ação do jogador
  const queue = (c: Cmd) => { pendingCmd.current = c; };

  // autoscroll logs
  useEffect(() => {
    if (battleRef.current) battleRef.current.scrollTop = battleRef.current.scrollHeight;
  }, [logs, snap?.log]);
  useEffect(() => {
    if (calcRef.current) calcRef.current.scrollTop = calcRef.current.scrollHeight;
  }, [showCalc, snap?.calc]);

  // detecta queda de HP para ativar slash FX
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

  const accPlayer = snap ? finalAcc(
    { level: snap.player.level },
    { level: snap.enemy.level, attrs: snap.srv.enemy.attrs }
  ) : null;

  const accEnemy = snap ? finalAcc(
    { level: snap.enemy.level },
    { level: snap.player.level, attrs: snap.srv.player.attrs }
  ) : null;

  // ===== formatação do log (cores + ícones) =====
  function decorate(text: string, side: "neutral" | "player" | "enemy") {
    let t = text
      .replace(/\(crit\)/gi, '(crit) 💥')
      .replace(/\btrue[- ]?dano:? ?sim\b/gi, 'true:sim ☀️')
      .replace(/\bredução de dano acionada\b/gi, 'redução de dano acionada 🌙');

    let color = "#e5e7eb";
    if (/erra|erro|miss/i.test(t)) color = "#f6c453";
    else if (/esquiv|dodge/i.test(t)) color = "#60a5fa";
    else if (side === "player") color = "#22c55e";
    else if (side === "enemy") color = "#ef4444";

    t = t.replace(/\b(\d+)\b/g, (m) => `<b>${m}</b>`);
    return { __html: t, color };
  }

  /* ===== dados da coluna direita (estágios) ===== */
  const stage = snap?.srv?.stage ?? 1;
  const goldTotal = snap?.srv?.gold ?? 0;
  const lastStageToShow = Math.max(stage + 4, 7);
  const stageRows = Array.from({ length: lastStageToShow }, (_, i) => i + 1);

  /* ===== ordem de turnos (trilha + tokens) ===== */
  const turnTrail = useMemo(() => {
    if (!snap) return [];
    const pSpd = snap.srv.player.attrs.dex + snap.srv.player.attrs.wis;
    const eSpd = snap.srv.enemy.attrs.dex + snap.srv.enemy.attrs.wis;
    const seq: ("player"|"enemy")[] = [];
    let p = 0, e = 0;
    for (let i=0;i<10;i++){
      if (p <= e) { seq.push("player"); p += Math.max(1, 1000/(pSpd+1)); }
      else        { seq.push("enemy");  e += Math.max(1, 1000/(eSpd+1)); }
    }
    return seq;
  }, [snap?.srv.player.attrs, snap?.srv.enemy.attrs, snap?.player?.hp, snap?.enemy?.hp]);

  // ===== meta das skills (dano/acc/mp/atributo) =====
  const skillMeta = useMemo(() => {
    if (!snap) return null;
    const A = snap.srv.player.attrs;
    const D = snap.srv.enemy.attrs;
    const acc = accPlayer ?? 0;

    const basic = (() => {
      const best = estBasicBase(A);
      const res  = estResist(D, best.kind);
      const dmg  = estimateDamage(best.base, res);
      return { label: "Ataque básico", dmg, acc, mp: 0, stat: "—" };
    })();

    const golpe = (() => {
      const base = Math.floor(meleeAttack(A) * 1.3);
      const res  = estResist(D, "melee");
      return { label: "Golpe Poderoso", dmg: estimateDamage(base, res), acc, mp: 10, stat: "STR" };
    })();

    const arcana = (() => {
      const base = Math.floor(magicAttack(A) * 1.5);
      const res  = estResist(D, "magic");
      return { label: "Explosão Arcana", dmg: estimateDamage(base, res), acc, mp: 12, stat: "INT" };
    })();

    const tiro = (() => {
      const base = Math.floor(rangedAttack(A) * 1.4);
      const res  = estResist(D, "ranged");
      return { label: "Tiro Preciso", dmg: estimateDamage(base, res), acc, mp: 8, stat: "DEX" };
    })();

    return { basic, golpe, arcana, tiro };
  }, [snap, accPlayer]);

  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>
        {/* ESQUERDA */}
        <div style={{ display: "grid", gap: 12 }}>
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

          {/* HUD: HP + MP + Avatares (sem barra de Ação) */}
          {snap && (
            <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {/* PLAYER */}
              <div style={{ ...card, position: "relative" }}>
                <div style={{ position: "absolute", left: -8, top: -8, width: 56, height: 56, borderRadius: 9999, background: "#1f6feb", display: "grid", placeItems: "center", boxShadow: "0 0 10px rgba(31,111,235,.6)" }}>
                  <span style={{ fontSize: 22, color: "#fff" }}>🧑‍🎤</span>
                </div>
                {/* slash FX */}
                {pSlash && <SlashFX />}

                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, paddingLeft: 56 }}>
                  <strong>Você</strong><span>Lv {snap.player.level}</span>
                </div>

                {/* HP */}
                <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4, paddingLeft: 56 }}>
                  HP {snap.player.hp}/{snap.player.hpMax}
                </div>
                <Bar value={(snap.player.hp / snap.player.hpMax) * 100} color="#2ecc71" />

                {/* MP */}
                <div style={{ fontSize: 12, opacity: 0.85, margin: "8px 0 4px", paddingLeft: 56 }}>
                  MP {snap.player.mp}/{snap.player.mpMax}
                </div>
                <Bar value={(snap.player.mp / snap.player.mpMax) * 100} color="#8a63d2" />
              </div>

              {/* ENEMY */}
              <div style={{ ...card, position: "relative" }}>
                <div style={{ position: "absolute", left: -8, top: -8, width: 56, height: 56, borderRadius: 9999, background: "#ef4444", display: "grid", placeItems: "center", boxShadow: "0 0 10px rgba(239,68,68,.6)" }}>
                  <span style={{ fontSize: 22, color: "#fff" }}>👹</span>
                </div>
                {/* slash FX */}
                {eSlash && <SlashFX />}

                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, paddingLeft: 56 }}>
                  <strong>{snap.enemy.name}</strong><span>Lv {snap.enemy.level}</span>
                </div>

                {/* HP */}
                <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4, paddingLeft: 56 }}>
                  HP {snap.enemy.hp}/{snap.enemy.hpMax}
                </div>
                <Bar value={(snap.enemy.hp / snap.enemy.hpMax) * 100} color="#2ecc71" />

                {/* MP */}
                <div style={{ fontSize: 12, opacity: 0.85, margin: "8px 0 4px", paddingLeft: 56 }}>
                  MP {snap.enemy.mp}/{snap.enemy.mpMax}
                </div>
                <Bar value={(snap.enemy.mp / snap.enemy.mpMax) * 100} color="#8a63d2" />
              </div>
            </section>
          )}

          {/* ORDEM DE TURNOS (com trilha) */}
          {snap && (
            <section>
              <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 6 }}>Ordem de turnos</div>
              <div style={{
                position: "relative",
                height: 40,
                borderRadius: 10,
                background: "linear-gradient(180deg,#0e0e0e,#0b0b0b)",
                border: "1px solid #1a1a1a",
                display: "flex",
                alignItems: "center",
                padding: "0 10px",
                gap: 10,
                overflowX: "auto"
              }}>
                {turnTrail.map((who, i) => (
                  <div key={i} title={who === "player" ? "Você" : snap.enemy.name}
                       style={{
                         minWidth: 34, height: 22, borderRadius: 8, display: "flex",
                         alignItems: "center", justifyContent: "center",
                         background: who === "player" ? "rgba(46,204,113,.15)" : "rgba(239,68,68,.15)",
                         border: `1px solid ${who === "player" ? "rgba(46,204,113,.4)" : "rgba(239,68,68,.4)"}`
                       }}>
                    <span style={{ fontSize: 13 }}>{who === "player" ? "👑" : "👹"}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ATRIBUTOS + XP */}
          {snap && (
            <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <strong>Seus atributos</strong>
                  {/* XP (placeholder 0%) */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, opacity: 0.8 }}>XP</span>
                    <div style={{ width: 120 }}>
                      <Bar value={0} color="#29b6f6" />
                    </div>
                  </div>
                </div>
                <AttrGrid a={snap.srv.player.attrs} b={snap.srv.enemy.attrs} level={snap.player.level} accShown={accPlayer} />
              </div>

              <div style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <strong>Atributos do inimigo</strong><span>Lv {snap.enemy.level}</span>
                </div>
                <AttrGrid a={snap.srv.enemy.attrs} b={snap.srv.player.attrs} level={snap.enemy.level} accShown={accEnemy} />
              </div>
            </section>
          )}

          {/* SUAS AÇÕES (compacto) */}
          {arenaId && snap && skillMeta && (
            <section style={{ ...card, display: "grid", gap: 8, padding: 10 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Suas ações</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <ActionBtn onClick={() => queue({ kind: "basic" })}
                           label="Ataque básico"
                           meta={`DMG≈${skillMeta.basic.dmg} • ACC≈${skillMeta.basic.acc}% • MP ${skillMeta.basic.mp}`} />
                <ActionBtn onClick={() => queue({ kind: "skill", id: "golpe_poderoso" })}
                           label="Golpe Poderoso"
                           meta={`DMG≈${skillMeta.golpe.dmg} • ACC≈${skillMeta.golpe.acc}% • MP ${skillMeta.golpe.mp} • ${skillMeta.golpe.stat}`} />
                <ActionBtn onClick={() => queue({ kind: "skill", id: "explosao_arcana" })}
                           label="Explosão Arcana"
                           meta={`DMG≈${skillMeta.arcana.dmg} • ACC≈${skillMeta.arcana.acc}% • MP ${skillMeta.arcana.mp} • ${skillMeta.arcana.stat}`} />
                <ActionBtn onClick={() => queue({ kind: "skill", id: "tiro_preciso" })}
                           label="Tiro Preciso"
                           meta={`DMG≈${skillMeta.tiro.dmg} • ACC≈${skillMeta.tiro.acc}% • MP ${skillMeta.tiro.mp} • ${skillMeta.tiro.stat}`} />
                <ActionBtn onClick={() => queue({ kind: "buff", id: "foco" })}        label="Foco"        meta="+ACERTO por 2T" />
                <ActionBtn onClick={() => queue({ kind: "buff", id: "fortalecer" })}  label="Fortalecer"  meta="+DANO por 2T" />
                <ActionBtn onClick={() => queue({ kind: "buff", id: "enfraquecer" })} label="Enfraquecer" meta="-RESIST do alvo por 2T" />
              </div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>A ação escolhida é usada automaticamente quando sua barra “Ação” atinge 100.</div>
            </section>
          )}

          {/* LOGS (batalha em cima, cálculos embaixo) */}
          <section style={{ display: "grid", gap: 8 }}>
            <div ref={battleRef} style={{ ...card, maxHeight: 220, padding: 10, overflow: "auto" }}>
              {(logs.length ? logs : snap?.log ?? []).map((l, i) => {
                const d = decorate(l.text, l.side);
                return (
                  <div key={i}
                       style={{ padding: "6px 4px", borderBottom: "1px solid #151515", color: d.color as string }}
                       dangerouslySetInnerHTML={{ __html: d.__html }} />
                );
              })}
            </div>

            <aside style={{ ...card, padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ marginBottom: 6, fontWeight: 600, fontSize: 14 }}>Cálculos</h3>
                <button onClick={() => setShowCalc((v) => !v)} style={{ padding: "4px 8px", borderRadius: 6, background: "#1f2937", fontSize: 12 }}>
                  {showCalc ? "Ocultar" : "Ver"}
                </button>
              </div>
              {showCalc ? (
                <div ref={calcRef} style={{ fontSize: 12, maxHeight: 180, overflow: "auto" }}>
                  {(snap?.calc ?? []).map((c, i) => (
                    <div key={i} style={{ borderBottom: "1px solid #151515", padding: "4px 2px" }}>{c.text}</div>
                  ))}
                </div>
              ) : (
                <div className="muted" style={{ fontSize: 12 }}>Clique em “Ver” para exibir cálculos aqui.</div>
              )}
            </aside>
          </section>

          {/* Resultado + próximo estágio */}
          {ended && (
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ opacity: 0.9 }}>
                Resultado: {ended === "draw" ? "empate" : ended === "player" ? "você venceu" : "você perdeu"}
              </div>
              {ended === "player" && arenaId && !auto && (
                <button onClick={() => loop(arenaId)} style={{ padding: "8px 12px", borderRadius: 8, background: "#2ecc71" }}>
                  Próximo estágio
                </button>
              )}
            </div>
          )}
        </div>

        {/* DIREITA: Progresso (minimizável) */}
        <aside style={{ ...card, position: "sticky", top: 12, height: "fit-content" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h3 style={{ marginBottom: 8, fontWeight: 600 }}>Progresso da Arena</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 12, opacity: 0.9 }}>💰 Ouro: <b>{goldTotal}</b></div>
              <button onClick={() => setProgMin(v => !v)} style={{ padding: "4px 8px", background: "#1f2937", borderRadius: 6, fontSize: 12 }}>
                {progMin ? "Expandir" : "Minimizar"}
              </button>
            </div>
          </div>

          {!progMin && (
            <>
              <div style={{ fontSize: 12, marginBottom: 8 }}>
                Estágio atual: <b>{stage}</b>
              </div>

              <div style={{ border: "1px solid #1e1e1e", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "54px 1fr 88px", background: "#111", padding: "6px 8px", fontWeight: 600, fontSize: 12 }}>
                  <div>Est.</div>
                  <div>Inimigo</div>
                  <div style={{ textAlign: "right" }}>Status</div>
                </div>
                <div>
                  {stageRows.map((s) => {
                    const isPast = s < stage;
                    const isCurrent = s === stage && snap;
                    const hpPct = isCurrent ? Math.round((snap!.enemy.hp / snap!.enemy.hpMax) * 100) : null;
                    return (
                      <div key={s} style={{ display: "grid", gridTemplateColumns: "54px 1fr 88px", padding: "6px 8px", borderTop: "1px solid #151515", alignItems: "center" }}>
                        <div>#{s}</div>
                        <div>{stageName(s)}</div>
                        <div style={{ textAlign: "right", opacity: 0.95 }}>
                          {isPast ? "✔ Concluído" : isCurrent ? `${hpPct}% HP` : "—"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ fontSize: 11, opacity: 0.8, marginTop: 8 }}>
                Dica: com “Auto” ligado, o próximo estágio inicia automaticamente ao derrotar o inimigo.
              </div>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}

/* ==== Componentes auxiliares ==== */
function Bar({ value, color = "#2ecc71" }: { value: number; color?: string }) {
  const w = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div style={{ height: 10, background: "#222", borderRadius: 6, overflow: "hidden" }}>
      <div style={{ width: `${w}%`, height: "100%", background: color, transition: "width 160ms linear" }} />
    </div>
  );
}

function AttrGrid({ a, b, level, accShown }: { a: Attrs; b: Attrs; level: number; accShown?: number | null }) {
  const arrow = (x: number, y: number) => {
    const d = x - y;
    const s = d >= 10 ? "↑↑↑" : d >= 5 ? "↑↑" : d > 0 ? "↑" : d <= -10 ? "↓↓↓" : d <= -5 ? "↓↓" : d < 0 ? "↓" : "";
    const c = d > 0 ? "#2ecc71" : d < 0 ? "#e74c3c" : "#9aa0a6";
    return <span style={{ marginLeft: 4, fontSize: 11, color: c }}>{s}</span>;
  };
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 6, fontSize: 12 }}>
        <div>STR {a.str}{arrow(a.str, b.str)}</div>
        <div>DEX {a.dex}{arrow(a.dex, b.dex)}</div>
        <div>INT {a.intt}{arrow(a.intt, b.intt)}</div>
        <div>WIS {a.wis}{arrow(a.wis, b.wis)}</div>
        <div>CHA {a.cha}{arrow(a.cha, b.cha)}</div>
        <div>CON {a.con}{arrow(a.con, b.con)}</div>
        <div>LUCK {a.luck}{arrow(a.luck, b.luck)}</div>
      </div>
      {typeof accShown === "number" && (
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9 }}>
          Precisão efetiva contra o alvo: <b>{accShown}%</b>
        </div>
      )}
    </>
  );
}

function ActionBtn({ onClick, label, meta }: { onClick: () => void; label: string; meta?: string }) {
  return (
    <button onClick={onClick}
            className="btn"
            style={{ padding: "8px 10px", background: "#1f2937", borderRadius: 8, fontSize: 14, lineHeight: 1 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        {meta && <span style={{ fontSize: 11, opacity: 0.9 }}>{meta}</span>}
      </div>
    </button>
  );
}

/* --- Efeito visual de “slash/corte” quando há perda de HP --- */
function SlashFX() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.style.opacity = "0";
      el.style.transform = "translate(-10px, -10px) rotate(-24deg) scale(1.05)";
    });
  }, []);
  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: -18,
        top: -18,
        width: 96,
        height: 96,
        pointerEvents: "none",
        opacity: 0.95,
        transform: "translate(0,0) rotate(-24deg) scale(1)",
        transition: "transform 380ms ease, opacity 380ms ease",
        background:
          "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.95) 50%, rgba(255,255,255,0) 100%)",
        filter: "drop-shadow(0 0 6px rgba(255,255,255,.7))",
        maskImage:
          "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 35%, rgba(0,0,0,1) 65%, rgba(0,0,0,0) 100%)",
        WebkitMaskImage:
          "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 35%, rgba(0,0,0,1) 65%, rgba(0,0,0,0) 100%)",
      }}
    />
  );
}
