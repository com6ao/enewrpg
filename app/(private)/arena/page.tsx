"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import InventoryPanel from "@/app/components/InventoryPanel";
import type { Attr as Attrs } from "@/lib/formulas";
import {
  meleeAttack,
  rangedAttack,
  magicAttack,
  mentalAttack,
  resistPhysicalMelee,
  resistPhysicalRanged,
  resistMagic,
  resistMental,
  clamp,
  dodgeChance,
  accuracyPercent,
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
type StartResp = { id: string; snap: Snap };
type StepResp = { id: string; snap: Snap; lines: Log[]; status: "active" | "finished"; winner: null | "player" | "enemy" | "draw"; cursor: number };

/* ===== helpers da UI (sem duplicar fórmulas do motor) ===== */
const accuracyFinal = (att: { level: number }, def: { level: number; attrs: Attrs }) =>
  clamp(accuracyPercent(att.level, def.level) - dodgeChance(def.attrs), 5, 100);

const resistByKind = (def: Attrs, k: "melee" | "magic" | "ranged" | "mental") =>
  k === "melee" ? resistPhysicalMelee(def) : k === "magic" ? resistMagic(def) : k === "ranged" ? resistPhysicalRanged(def) : resistMental(def);

const estimateDamage = (base: number, res: number) => Math.max(1, base - Math.floor(res * 0.35));

const bestBasic = (a: Attrs) =>
  [
    { base: meleeAttack(a), kind: "melee" as const },
    { base: magicAttack(a), kind: "magic" as const },
    { base: rangedAttack(a), kind: "ranged" as const },
    { base: mentalAttack(a), kind: "mental" as const },
  ].sort((x, y) => y.base - x.base)[0];

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

  useEffect(() => {
    document.body.classList.add("arena-page");
    return () => document.body.classList.remove("arena-page");
  }, []);

  const [pSlash, setPSlash] = useState(false);
  const [eSlash, setESlash] = useState(false);
  const prevHpRef = useRef<{ p: number; e: number } | null>(null);
@@ -142,52 +123,52 @@ export default function ArenaPage() {
  };

  useEffect(() => {
    if (battleRef.current) battleRef.current.scrollTop = battleRef.current.scrollHeight;
  }, [logs, snap?.log]);
  useEffect(() => {
    if (calcRef.current) calcRef.current.scrollTop = calcRef.current.scrollHeight;
  }, [showCalc, snap?.calc]);

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

  const accPlayer = snap ? accuracyFinal({ level: snap.player.level }, { level: snap.enemy.level, attrs: snap.srv.enemy.attrs }) : null;
  const accEnemy = snap ? accuracyFinal({ level: snap.enemy.level }, { level: snap.player.level, attrs: snap.srv.player.attrs }) : null;
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
  const gold = snap?.srv?.gold ?? 0;
  const lastStage = Math.max(stage + 4, 7);

  const turnTrail = useMemo(() => {
    if (!snap) return [];
    const pSpd = snap.srv.player.attrs.dex + snap.srv.player.attrs.wis;
    const eSpd = snap.srv.enemy.attrs.dex + snap.srv.enemy.attrs.wis;
    const seq: ("player" | "enemy")[] = [];
    let p = 0,
