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
  // inclui progresso
  srv: { player: { attrs: Attrs; level: number }; enemy: { attrs: Attrs; level: number }; stage: number; gold: number };
};
type StartResp = { id: string; snap: Snap };
type StepResp = { id: string; snap: Snap; lines: Log[]; status: "active" | "finished"; winner: null | "player" | "enemy" | "draw"; cursor: number };

/* ===== fórmulas mínimas p/ UI (precisão exibida) ===== */
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

/* ===== UI helpers ===== */
const atbSpeed = (a: Attrs) => 0.4 + (a.dex + a.wis) * 0.08; // mesma fórmula do motor

function Bar({
  value,
  color = "#2ecc71",
  smoothMs = 40,
}: { value: number; color?: string; smoothMs?: number }) {
  const w = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div
      style={{
        height: 10,
        background: "#222",
        borderRadius: 6,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* faixa animada */}
      <div
        style={{
          width: `${w}%`,
          height: "100%",
          background: color,
          transition: `width ${smoothMs}ms linear`,
        }}
      />

      {/* cursor */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: `calc(${w}% - 1px)`,
          width: 2,
          height: "100%",
          background: "rgba(255,255,255,.9)",
          boxShadow: "0 0 6px rgba(255,255,255,.9)",
          transition: `left ${smoothMs}ms linear`,
          pointerEvents: "none",
        }}
      />
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

/* ==== nome do estágio (mesma lógica do servidor) ==== */
const stageName = (s: number) =>
  s === 1 ? "Rato Selvagem" : s === 2 ? "Lobo Faminto" : s === 3 ? "Goblin Batedor" : `Elite ${s}`;

/* === NOVOS HELPERS/UI === */
type TurnBadge = { who: "player" | "enemy"; at: number };
function projectTurns(
  pAtb: number,
  eAtb: number,
  pAttrs: Attrs,
  eAttrs: Attrs,
  slots = 12
): TurnBadge[] {
  let pa = pAtb, ea = eAtb;
  const ps = atbSpeed(pAttrs);
  const es = atbSpeed(eAttrs);

  const out: TurnBadge[] = [];
  let t = 0;
  while (out.length < slots) {
    const needP = Math.max(0, 100 - pa);
    const needE = Math.max(0, 100 - ea);
    const dtP = needP / ps;
    const dtE = needE / es;
    const dt = Math.min(dtP, dtE, 1e9);
    t += dt;
    pa += ps * dt;
    ea += es * dt;

    if (pa >= 100 && pa >= ea) { out.push({ who: "player", at: t }); pa -= 100; }
    else if (ea >= 100)       { out.push({ who: "enemy",  at: t }); ea -= 100; }
  }
  return out;
}

function TimelineBar({
  playerAtb,
  enemyAtb,
  pAttrs,
  eAttrs,
}: {
  playerAtb: number;
  enemyAtb: number;
  pAttrs: Attrs;
  eAttrs: Attrs;
}) {
  const badges = projectTurns(playerAtb, enemyAtb, pAttrs, eAttrs, 12);
  const maxAt = badges[badges.length - 1]?.at || 1;

  return (
    <div style={{ background: "#1a1a1a", height: 16, borderRadius: 8, position: "relative", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: `${Math.min(99, Math.max(0, (Math.max(playerAtb, enemyAtb) / 100) * 100))}%`,
          width: 2,
          height: "100%",
          background: "rgba(255,255,255,.6)",
          boxShadow: "0 0 6px rgba(255,255,255,.9)",
        }}
      />
      {badges.map((b, i) => (
        <div
          key={i}
          title={b.who === "player" ? "Você" : "Inimigo"}
          style={{
            position: "absolute",
            top: -10,
            left: `${(b.at / maxAt) * 100}%`,
            transform: "translateX(-50%)",
            fontSize: 12,
            pointerEvents: "none",
          }}
        >
          <span style={{ filter: "drop-shadow(0 0 2px #000)" }}>
            {b.who === "player" ? "👑" : "😈"}
          </span>
        </div>
      ))}
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
  const [progOpen, setProgOpen] = useState(true);

  // animações
  const [animPlayer, setAnimPlayer] = useState<null | "slash" | "hit" | "evade" | "crit" | "reduce">(null);
  const [animEnemy,  setAnimEnemy ] = useState<null | "slash" | "hit" | "evade" | "crit" | "reduce">(null);

  useEffect(() => {
    if (!logs.length) return;
    const last = logs[logs.length - 1];
    const txt = last.text.toLowerCase();

    const isCrit   = /crit/.test(txt);
    const isEvade  = /erra|miss|esquiv/.test(txt);
    const isReduce = /redução de dano/.test(txt);
    const isPlayer = last.side === "player";
    const isEnemy  = last.side === "enemy";

    const set = (who: "player" | "enemy", kind: typeof animPlayer) => {
      (who === "player" ? setAnimPlayer : setAnimEnemy)(kind);
      setTimeout(() => (who === "player" ? setAnimPlayer : setAnimEnemy)(null), 500);
    };

    if (isEvade) { set(isPlayer ? "enemy" : "player", "evade"); return; }
    if (isReduce){ set(isPlayer ? "enemy" : "player", "reduce"); return; }
    if (isCrit)  { set(isPlayer ? "enemy" : "player", "crit"); return; }

    if (isPlayer) { set("player", "slash"); setTimeout(() => set("enemy", "hit"), 120); }
    if (isEnemy)  { set("enemy",  "slash"); setTimeout(() => set("player","hit"), 120); }
  }, [logs]);

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

    // inicia o clock
    loop(data.id);
  }

  // fila de ação do jogador
  const queue = (c: Cmd) => { pendingCmd.current = c; };

  const accPlayer = snap ? finalAcc(
    { level: snap.player.level },
    { level: snap.enemy.level, attrs: snap.srv.enemy.attrs }
  ) : null;

  const accEnemy = snap ? finalAcc(
    { level: snap.enemy.level },
    { level: snap.player.level, attrs: snap.srv.player.attrs }
  ) : null;

  // formatação do log
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

  // dados da coluna direita
  const stage = snap?.srv?.stage ?? 1;
  const goldTotal = snap?.srv?.gold ?? 0;
  const lastStageToShow = Math.max(stage + 4, 5);
  const stageRows = Array.from({ length: lastStageToShow }, (_, i) => i + 1);

  // auto-scroll para os logs
  const logRef  = useRef<HTMLDivElement | null>(null);
  const calcRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { if (logRef.current)  logRef.current.scrollTop  = logRef.current.scrollHeight; }, [logs]);
  useEffect(() => { if (calcRef.current) calcRef.current.scrollTop = calcRef.current.scrollHeight; }, [snap?.calc]);

  return (
    <main style={{ maxWidth: 1360, margin: "0 auto", padding: 16 }}>
      {/* layout 2 colunas */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>
        {/* ESQUERDA */}
        <div style={{ display: "grid", gap: 16 }}>
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

          {/* HUD: HP + MP + Timeline */}
          {snap && (
            <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Player */}
              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div className={
                    animPlayer === "slash" ? "anim-slash" :
                    animPlayer === "hit"   ? "anim-hit"   :
                    animPlayer === "evade" ? "anim-evade" :
                    animPlayer === "crit"  ? "anim-crit"  :
                    animPlayer === "reduce"? "anim-reduce": ""
                  } style={{
                    width: 36, height: 36, borderRadius: 9999, background: "#0ea5e9",
                    display: "grid", placeItems: "center", fontSize: 18
                  }}>👤</div>
                  <div style={{ display: "flex", justifyContent: "space-between", flex: 1 }}>
                    <strong>Você</strong>
                    <span>Lv {snap.player.level}</span>
                  </div>
                </div>

                <Bar value={(snap.player.hp / snap.player.hpMax) * 100} />
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>HP {snap.player.hp}/{snap.player.hpMax}</div>
                <Bar value={(snap.player.mp / snap.player.mpMax) * 100} color="#6366f1" />
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>MP {snap.player.mp}/{snap.player.mpMax}</div>
              </div>

              {/* Enemy */}
              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div className={
                    animEnemy === "slash" ? "anim-slash" :
                    animEnemy === "hit"   ? "anim-hit"   :
                    animEnemy === "evade" ? "anim-evade" :
                    animEnemy === "crit"  ? "anim-crit"  :
                    animEnemy === "reduce"? "anim-reduce": ""
                  } style={{
                    width: 36, height: 36, borderRadius: 9999, background: "#ef4444",
                    display: "grid", placeItems: "center", fontSize: 18
                  }}>👹</div>
                  <div style={{ display: "flex", justifyContent: "space-between", flex: 1 }}>
                    <strong>{snap.enemy.name}</strong>
                    <span>Lv {snap.enemy.level}</span>
                  </div>
                </div>

                <Bar value={(snap.enemy.hp / snap.enemy.hpMax) * 100} color="#16a34a" />
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>HP {snap.enemy.hp}/{snap.enemy.hpMax}</div>
                <Bar value={(snap.enemy.mp / snap.enemy.mpMax) * 100} color="#8b5cf6" />
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>MP {snap.enemy.mp}/{snap.enemy.mpMax}</div>
              </div>

              {/* Timeline */}
              <div style={{ gridColumn: "1 / span 2" }}>
                <div style={{ marginBottom: 6, fontSize: 12, opacity: 0.85 }}>Ordem de ações (estimada)</div>
                <TimelineBar
                  playerAtb={snap.player.atb}
                  enemyAtb={snap.enemy.atb}
                  pAttrs={snap.srv.player.attrs}
                  eAttrs={snap.srv.enemy.attrs}
                />
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

          {/* Controles */}
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

          {/* Logs + Cálculos (calc abaixo do log) */}
          <section style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            <div ref={logRef} style={{ ...card, maxHeight: 220, overflow: "auto" }}>
              {logs.map((l, i) => {
                const d = decorate(l.text, l.side);
                return (
                  <div
                    key={i}
                    style={{ padding: "6px 4px", borderBottom: "1px solid #151515", color: d.color as string }}
                    dangerouslySetInnerHTML={{ __html: d.__html }}
                  />
                );
              })}
            </div>

            <div ref={calcRef} style={{ ...card, maxHeight: 160, overflow: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ marginBottom: 8, fontWeight: 600 }}>Cálculos</h3>
                <button onClick={() => setShowCalc((v) => !v)} style={{ padding: "6px 8px", borderRadius: 8, background: "#1f2937", fontSize: 12 }}>
                  {showCalc ? "Ocultar" : "Ver"}
                </button>
              </div>
              {showCalc ? (
                <div style={{ fontSize: 12 }}>
                  {(snap?.calc ?? []).map((c, i) => (
                    <div key={i} style={{ borderBottom: "1px solid #151515", padding: "4px 2px" }}>{c.text}</div>
                  ))}
                </div>
              ) : (
                <div className="muted" style={{ fontSize: 12 }}>Clique em “Ver” para exibir cálculos aqui.</div>
              )}
            </div>
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

        {/* DIREITA: progresso colapsável */}
        <aside style={{ ...card, position: "sticky", top: 12, height: "fit-content" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h3 style={{ marginBottom: 8, fontWeight: 600 }}>Progresso da Arena</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 12, opacity: 0.9 }}>💰 <b>{goldTotal}</b></div>
              <button onClick={() => setProgOpen(v => !v)} style={{ padding: "4px 8px", borderRadius: 6, background: "#1f2937", fontSize: 12 }}>
                {progOpen ? "Minimizar" : "Expandir"}
              </button>
            </div>
          </div>

          {progOpen && (
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

      {/* animações CSS */}
      <style jsx global>{`
        @keyframes slash { 0%{transform: translateX(0) skewX(-12deg)} 100%{transform: translateX(10px) skewX(0)} }
        @keyframes hit   { 0%{transform: translateX(0)} 30%{transform: translateX(-6px)} 100%{transform: translateX(0)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.35} }
        .anim-slash { animation: slash .35s ease; }
        .anim-hit   { animation: hit .35s ease; }
        .anim-evade { animation: blink .5s linear; }
        .anim-crit  { animation: blink .5s linear 0s 2; filter: drop-shadow(0 0 6px #ffec99); }
        .anim-reduce{ animation: blink .5s linear 0s 2; filter: drop-shadow(0 0 6px #9ad0ec); }
      `}</style>
    </main>
  );
}
