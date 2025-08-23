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
  // ⬇️ acrescentei stage e gold (mantive o resto)
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

      {/* “cursor” tipo ampulheta andando na borda da barra */}
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

/* ===== Página ===== */
export default function ArenaPage() {
  const [arenaId, setArenaId] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snap | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [showCalc, setShowCalc] = useState(false);
  const [auto, setAuto] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ended, setEnded] = useState<null | "player" | "enemy" | "draw">(null);

  // 🔵 progresso visual contínuo das barras (0..100)
  const [progress, setProgress] = useState<{ player: number; enemy: number }>({ player: 0, enemy: 0 });

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

  // ====== LOOP com pausa quando Auto off e sem ação ======
  async function loop(id: string) {
    if (timer.current) clearTimeout(timer.current);

    // pausa o relógio se Auto estiver OFF e o jogador ainda não escolheu uma ação
    if (!auto && !pendingCmd.current) {
      timer.current = setTimeout(() => loop(id), 120);
      return;
    }

    const res = await stepOnce(id);
    if (!res) return;

    // reset visual das barras quando alguém age (com base nos logs da ação)
    if (res.lines?.length) {
      setLogs((p) => [...p, ...res.lines]);
      res.lines.forEach((l) => {
        if (l.side === "player") setProgress((pr) => ({ ...pr, player: 0 }));
        if (l.side === "enemy") setProgress((pr) => ({ ...pr, enemy: 0 }));
      });
    }

    setSnap(res.snap);

    if (res.status === "finished") {
      setEnded(res.winner);
      // Se Auto, avança sozinho para o próximo estágio
      if (auto) timer.current = setTimeout(() => loop(id), 450);
      return;
    }

    // continua o relógio
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
    // sincroniza o visual com o estado do motor ao iniciar
    setProgress({ player: data.snap.player.atb, enemy: data.snap.enemy.atb });
    setBusy(false);

    // sempre inicia o clock (o loop pausa se Auto off e sem ação)
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

  // ===== formatação do log (cores + ícones) =====
  function decorate(text: string, side: "neutral" | "player" | "enemy") {
    // ícones
    let t = text
      .replace(/\(crit\)/gi, '(crit) 💥')
      .replace(/\btrue[- ]?dano:? ?sim\b/gi, 'true:sim ☀️')
      .replace(/\bredução de dano acionada\b/gi, 'redução de dano acionada 🌙');

    // cores
    let color = "#e5e7eb"; // neutro
    if (/erra|erro|miss/i.test(t)) color = "#f6c453";         // amarelo
    else if (/esquiv|dodge/i.test(t)) color = "#60a5fa";      // azul
    else if (side === "player") color = "#22c55e";            // verde
    else if (side === "enemy") color = "#ef4444";             // vermelho

    // destaca números de dano
    t = t.replace(/\b(\d+)\b/g, (m) => `<b>${m}</b>`);

    return { __html: t, color };
  }

  /* ===== dados da coluna direita (estágios) ===== */
  const stage = snap?.srv?.stage ?? 1;
  const goldTotal = snap?.srv?.gold ?? 0;
  const lastStageToShow = Math.max(stage + 4, 5);
  const stageRows = Array.from({ length: lastStageToShow }, (_, i) => i + 1);

  /* ===== animação contínua do ATB (visual) =====
     Usa a mesma fórmula do motor. Avança a cada frame e trava em 100.
     Quando o motor executa uma ação (detectada nos logs), a barra correspondente é resetada para 0 acima. */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = (now - last) / 1000; // segundos desde o último frame
      last = now;

      if (snap) {
        const spPlayer = atbSpeed(snap.srv.player.attrs);
        const spEnemy  = atbSpeed(snap.srv.enemy.attrs);

        setProgress((p) => ({
          player: clamp(p.player + spPlayer * dt, 0, 100),
          enemy:  clamp(p.enemy  + spEnemy  * dt, 0, 100),
        }));
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [snap?.srv.player.attrs, snap?.srv.enemy.attrs]); // recomeça o loop se atributos mudarem

  // mantém o visual sincronizado quando o motor reporta ATB “saltado” (mudança de estágio etc.)
  useEffect(() => {
    if (!snap) return;
    setProgress({
      player: clamp(snap.player.atb, 0, 100),
      enemy:  clamp(snap.enemy.atb, 0, 100),
    });
  }, [snap?.player.atb, snap?.enemy.atb, snap?.srv.stage]);

  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: 16 }}>
      {/* layout em 2 colunas: conteúdo + coluna direita */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 12 }}>
        {/* ESQUERDA: tudo que você já tinha */}
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
                {/* ⬇️ usa progresso visual contínuo */}
                <Bar value={progress.player} color="#00bcd4" />
              </div>
              <div style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <strong>{snap.enemy.name}</strong><span>Lv {snap.enemy.level}</span>
                </div>
                <Bar value={(snap.enemy.hp / snap.enemy.hpMax) * 100} />
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>HP {snap.enemy.hp}/{snap.enemy.hpMax}</div>
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9 }}>Ação</div>
                {/* ⬇️ usa progresso visual contínuo */}
                <Bar value={progress.enemy} color="#ff9800" />
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

        {/* DIREITA: nova coluna com estágios/progresso */}
        <aside style={{ ...card, position: "sticky", top: 12, height: "fit-content" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h3 style={{ marginBottom: 8, fontWeight: 600 }}>Progresso da Arena</h3>
            <div style={{ fontSize: 12, opacity: 0.9 }}>💰 Ouro: <b>{goldTotal}</b></div>
          </div>

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
        </aside>
      </div>
    </main>
  );
}
