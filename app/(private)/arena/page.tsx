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

type Attrs = {
  level: number;
  str: number;
  dex: number;
  intt: number;
  wis: number;
  cha: number;
  con: number;
  luck: number;
};

export default function ArenaPage() {
  const [area, setArea] = useState<"creep" | "jungle" | "ancient" | "boss">("creep");
  const [auto, setAuto] = useState(true);
  const [state, setState] = useState<"idle" | "loading" | "playing" | "done">("idle");

  const [battle, setBattle] = useState<Battle>(null);
  const [playerAttrs, setPlayerAttrs] = useState<Attrs | null>(null);
  const [enemyAttrs, setEnemyAttrs] = useState<Attrs | null>(null);

  const [lines, setLines] = useState<any[]>([]);
  const timer = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function startBattle() {
    setState("loading");
    setLines([]);
    setBattle(null);
    const r = await fetch("/api/battle/start", {
      method: "POST",
      body: JSON.stringify({ area }),
    });
    if (!r.ok) {
      alert(await r.text());
      setState("idle");
      return;
    }
    const data = await r.json();
    setBattle(data.battle);
    setPlayerAttrs(data.player_attrs ?? null);
    setEnemyAttrs(data.enemy_attrs ?? null);
    setState("playing");
    if (auto) stepAuto(data.battle.id);
  }

  async function actOnce(battle_id: string) {
    const r = await fetch("/api/battle/act", {
      method: "POST",
      body: JSON.stringify({ battle_id, steps: 1 }),
    });
    if (!r.ok) {
      alert(await r.text());
      return null;
    }
    return r.json();
  }

  async function stepAuto(battle_id: string) {
    if (timer.current) clearTimeout(timer.current);
    const res = await actOnce(battle_id);
    if (!res) return;
    setBattle(res.battle);
    setLines((prev) => [...prev, ...res.lines]);
    if (res.battle.status === "finished") {
      setState("done");
      return;
    }
    if (auto) timer.current = setTimeout(() => stepAuto(battle_id), 550);
  }

  async function nextTurn() {
    if (!battle) return;
    const res = await actOnce(battle.id);
    if (!res) return;
    setBattle(res.battle);
    setLines((prev) => [...prev, ...res.lines]);
    if (res.battle.status === "finished") setState("done");
  }

  function reset() {
    if (timer.current) clearTimeout(timer.current);
    setState("idle");
    setBattle(null);
    setLines([]);
    setPlayerAttrs(null);
    setEnemyAttrs(null);
  }

  // formata 1 linha do log
  function formatLine(item: any): string {
    if (typeof item === "string") return item;

    const desc = item.description ?? "";
    const dmg = item.damage ?? item.dmg ?? item.amount ?? null;
    const dtype = item.damage_type ?? item.kind ?? null;

    const f = item.formula ?? item.calc ?? null;
    const parts: string[] = [];
    if (desc) parts.push(desc);
    if (dmg != null) parts.push(`Dano: ${dmg}${dtype ? ` (${dtype})` : ""}`);
    if (f && typeof f === "object") {
      const kv = [
        `atk:${f.atk}`,
        `def:${f.def}`,
        `base:${f.base}`,
        `crit:${!!f.crit}`,
        `mult:${f.mult}`,
        `rand:${f.rand}`,
      ]
        .filter(Boolean)
        .join(", ");
      parts.push(`Cálculo: ${kv}`);
    }
    if (item.target_hp_after != null)
      parts.push(`HP alvo após: ${item.target_hp_after}`);

    return parts.filter(Boolean).join(" · ");
  }

  function AttrBox({ title, a }: { title: string; a: Attrs | null }) {
    if (!a)
      return (
        <div className="card" style={{ padding: 8 }}>
          <h3>{title}</h3>
          <div className="muted">Atributos indisponíveis</div>
        </div>
      );
    return (
      <div className="card" style={{ padding: 8 }}>
        <h3>{title}</h3>
        <div className="muted">Lv {a.level}</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,minmax(0,1fr))",
            gap: 6,
            marginTop: 6,
            fontSize: 12,
          }}
        >
          <div>STR {a.str}</div>
          <div>DEX {a.dex}</div>
          <div>INT {a.intt}</div>
          <div>WIS {a.wis}</div>
          <div>CHA {a.cha}</div>
          <div>CON {a.con}</div>
          <div>LUCK {a.luck}</div>
          <div />
        </div>
      </div>
    );
  }

  return (
    <main className="container" style={{ display: "grid", gap: 12 }}>
      <h1>Arena</h1>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {(["creep", "jungle", "ancient", "boss"] as const).map((a) => (
          <button
            key={a}
            className="btn"
            disabled={state !== "idle"}
            onClick={() => setArea(a)}
            style={{ background: area === a ? "#3498db" : undefined }}
          >
            {a}
          </button>
        ))}

        <button
          className="btn"
          onClick={startBattle}
          disabled={state !== "idle"}
          style={{ background: "#2ecc71" }} // verde
        >
          Lutar
        </button>

        {state !== "idle" && (
          <button
            className="btn"
            onClick={reset}
            style={{ background: "#e74c3c" }} // vermelho
          >
            Reset
          </button>
        )}

        <label
          style={{ marginLeft: 12, display: "flex", gap: 6, alignItems: "center" }}
        >
          <input
            type="checkbox"
            checked={auto}
            onChange={(e) => {
              setAuto(e.target.checked);
              if (e.target.checked && battle && state === "playing")
                stepAuto(battle.id);
            }}
          />
          Auto
        </label>

        {!auto && state === "playing" && (
          <button className="btn" onClick={nextTurn}>
            Próximo turno
          </button>
        )}
      </div>

      {battle && (
        <section className="card" style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <h3>Você</h3>
              <HPBar current={battle.player_hp} max={battle.player_hp_max} />
              <div style={{ marginTop: 8 }}>
                <AttrBox title="Atributos" a={playerAttrs} />
              </div>
            </div>
            <div>
              <h3>{battle.enemy_name}</h3>
              <HPBar current={battle.enemy_hp} max={battle.enemy_hp_max} />
              <div style={{ marginTop: 8 }}>
                <AttrBox title="Atributos" a={enemyAttrs} />
              </div>
            </div>
          </div>

          <div className="muted">
            Turnos revelados: {battle.cursor}{" "}
            {battle.status === "finished" ? "(finalizada)" : ""}
          </div>

          <div
            className="card"
            style={{ maxHeight: 260, overflow: "auto", background: "#0e0e0e" }}
          >
            {lines.map((line, i) => (
              <div
                key={i}
                style={{ padding: 6, borderBottom: "1px solid #222" }}
              >
                {formatLine(line)}
              </div>
            ))}
          </div>

          <div
            className="card"
            style={{ background: "#0e0e0e", padding: 10, fontSize: 12, color: "#bbb" }}
          >
            <b>Legenda do cálculo:</b> atk = ataque, def = defesa, base = dano-base,
            crit = crítico, mult = multiplicador do crítico, rand = fator aleatório.
          </div>

          {state === "done" && (
            <div className="card" style={{ background: "#111", padding: 12 }}>
              {battle.winner === "draw"
                ? "Empate"
                : battle.winner === "player"
                ? "Vitória"
                : "Derrota"}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
