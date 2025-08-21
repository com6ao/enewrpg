// app/api/battle/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

/** ===== Tipos ===== */
type Attrs = {
  str: number; dex: number; intt: number; wis: number; cha: number; con: number; luck: number;
};
type UnitState = {
  name: string;
  level: number;
  hp: number;
  hpMax: number;
  attrs: Attrs;
};
type CombatLine = {
  text: string;
  dmg: number;
  from: "player" | "enemy";
  to: "player" | "enemy";
  kind: "hit" | "crit" | "miss";
  source?: "player" | "enemy";
};

/** ===== Util ===== */
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const num = (v: any, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** ===== Fórmulas simples =====
 * Pode alinhar depois com /lib/formulas.ts, se quiser.
 */
function hpFrom(level: number, con: number) {
  return Math.max(1, Math.floor(30 + level * 2 + con * 3));
}
function speedOf(u: UnitState) {
  // Velocidade baseada em DEX + WIS
  const { dex = 0, wis = 0 } = u.attrs ?? ({} as Attrs);
  return 0.4 + dex * 0.05 + wis * 0.03; // ~0.4..>2.0 por "tick"
}
function rng(luck: number) {
  const base = Math.random();
  const luckBoost = clamp(luck, 0, 100) / 100;
  return {
    base,
    crit: base > 0.9 - luckBoost * 0.2,
    miss: base < 0.05 * (1 - luckBoost * 0.6),
  };
}
function doAttack(
  atk: UnitState,
  def: UnitState,
  from: "player" | "enemy",
  to: "player" | "enemy"
): CombatLine {
  // Dano baseado em STR + INT
  const { str = 1, intt = 0, luck = 0 } = atk.attrs ?? ({} as Attrs);
  const roll = rng(luck);
  if (roll.miss) return { text: `${atk.name} errou o ataque!`, dmg: 0, from, to, kind: "miss" };
  const baseDmg = Math.max(1, Math.floor((str + intt) * 1.2 + (atk.level ?? 1) * 0.5));
  const spread = 0.8 + roll.base * 0.4; // 0.8–1.2
  let dmg = Math.floor(baseDmg * spread);
  let kind: CombatLine["kind"] = "hit";
  if (roll.crit) { dmg = Math.floor(dmg * 1.6); kind = "crit"; }
  return { text: `Dano: ${dmg} (${kind})`, dmg, from, to, kind };
}

/** Simula a luta completa, devolvendo summary e log para a animação */
function resolveCombat(player: UnitState, enemy: UnitState) {
  let p = { ...player }, e = { ...enemy };
  let gP = 0, gE = 0;
  const sP = speedOf(p), sE = speedOf(e);
  const log: CombatLine[] = [];

  const HP_CAP_ACTIONS = 200; // trava dura para não travar em edge cases
  while (p.hp > 0 && e.hp > 0 && log.length < HP_CAP_ACTIONS) {
    while (gP < 1 && gE < 1) { gP += sP; gE += sE; }
    if (gP >= gE) {
      const ln = doAttack(p, e, "player", "enemy"); ln.source = "player";
      e = { ...e, hp: clamp(e.hp - ln.dmg, 0, e.hpMax) };
      log.push(ln);
      gP -= 1;
    } else {
      const ln = doAttack(e, p, "enemy", "player"); ln.source = "enemy";
      p = { ...p, hp: clamp(p.hp - ln.dmg, 0, p.hpMax) };
      log.push(ln);
      gE -= 1;
    }
  }

  const finished = p.hp <= 0 || e.hp <= 0;
  const winner = finished ? (p.hp > 0 ? "player" : e.hp > 0 ? "enemy" : "draw") : null;

  const summary = {
    winner,
    player_hp_start: player.hpMax,
    enemy_hp_start: enemy.hpMax,
    player_hp_end: p.hp,
    enemy_hp_end: e.hp,
    actions: log.length,
  };

  return { summary, log };
}

/** Constrói estados a partir dos registros do banco */
function buildUnitFromCharacter(char: any): UnitState {
  const attrs: Attrs = {
    str: num(char?.str, 5),
    dex: num(char?.dex, 5),
    intt: num(char?.intt, 5),
    wis: num(char?.wis, 5),
    cha: num(char?.cha, 5),
    con: num(char?.con, 5),
    luck: num(char?.luck, 5),
  };
  const level = num(char?.level, 1);
  const hpMax = hpFrom(level, attrs.con);
  return {
    name: char?.name ?? "Você",
    level,
    hp: hpMax,
    hpMax,
    attrs,
  };
}
function buildUnitFromEnemy(enemy: any): UnitState {
  const attrs: Attrs = {
    str: num(enemy?.str, 5),
    dex: num(enemy?.dex, 5),
    intt: num(enemy?.intt, 5),
    wis: num(enemy?.wis, 5),
    cha: num(enemy?.cha, 5),
    con: num(enemy?.con, 5),
    luck: num(enemy?.luck, 5),
  };
  const level = num(enemy?.level, 1);
  const hpMax = hpFrom(level, attrs.con);
  return {
    name: enemy?.name ?? "Inimigo",
    level,
    hp: hpMax,
    hpMax,
    attrs,
  };
}

/** ===== Handler ===== */
export async function POST(req: Request) {
  const { area } = await req.json().catch(() => ({}));
  if (!area) return new NextResponse("Informe a área", { status: 400 });

  const supabase = await getSupabaseServer();

  // usuário
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Não autenticado", { status: 401 });

  // profile -> personagem ativo
  const { data: profile } = await supabase
    .from("profiles")
    .select("active_character_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.active_character_id) return new NextResponse("Nenhum personagem ativo", { status: 400 });

  // personagem
  const { data: char } = await supabase
    .from("characters")
    .select("*")
    .eq("id", profile.active_character_id)
    .maybeSingle();
  if (!char) return new NextResponse("Personagem não encontrado", { status: 400 });

  // inimigo por área
  const { data: enemies } = await supabase
    .from("enemies")
    .select("*")
    .eq("category", area);
  if (!enemies?.length) return new NextResponse("Nenhum inimigo para esta área", { status: 400 });

  const enemy = enemies[Math.floor(Math.random() * enemies.length)];

  // monta estados
  const playerState = buildUnitFromCharacter(char);
  const enemyState  = buildUnitFromEnemy(enemy);

  // resolve combate completo (para animação turno-a-turno no front)
  const { summary, log } = resolveCombat(playerState, enemyState);

  return NextResponse.json({
    enemy: { id: enemy.id, name: enemy.name, level: enemy.level },
    result: summary,
    log, // use no painel direito e na lista central
  });
}

/** GET simples para debug */
export async function GET() {
  return NextResponse.json({ ok: true, hint: "POST { area } para iniciar combate" });
}
