// app/(private)/layout.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import AuthGuard from "@/app/components/AuthGuard";
import { createBrowserClient } from "@supabase/ssr";
import { usePathname } from "next/navigation"; // <-- ADICIONADO
import type { Character } from "@/types/character";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();                         // <-- ADICIONADO
  const isArena = pathname?.startsWith("/arena");         // <-- ADICIONADO

  const [collapsed, setCollapsed] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [shopView, setShopView] = useState<null | "npc" | "market">(null);

  const [loadingChar, setLoadingChar] = useState(true);
  const [char, setChar] = useState<Character | null>(null);

  // Responsivo: sidebar cai para baixo em telas estreitas
  useEffect(() => {
    const update = () => setNarrow(window.innerWidth < 1024);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Carrega personagem ativo para PC/slots
  useEffect(() => {
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user;
        if (!user) {
          setLoadingChar(false);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("active_character_id")
          .eq("id", user.id)
          .maybeSingle();

        if (!profile?.active_character_id) {
          setChar(null);
          setLoadingChar(false);
          return;
        }

        const { data: personagem } = await supabase
          .from("characters")
          .select("id,name,surname,level,xp,str,dex,intt,wis,cha,con,luck")
          .eq("id", profile.active_character_id)
          .maybeSingle();

        setChar(personagem as Character | null);
      } finally {
        setLoadingChar(false);
      }
    })();
  }, []);

  // --- Poder de Combate (PC) ---
  function computePC(c: Character | null) {
    if (!c) return 0;
    const sum = c.str + c.dex + c.intt + c.wis + c.cha + c.con + c.luck;
    return sum * Math.max(1, c.level);
  }

  const pc = useMemo(() => computePC(char), [char]);

  const pcTooltip = useMemo(() => {
    if (!char)
      return "PC: requer personagem ativo.\nFórmula: (STR+DEX+INT+WIS+CHA+CON+LUCK) × LEVEL";
    const parts = [
      `STR:${char.str}`,
      `DEX:${char.dex}`,
      `INT:${char.intt}`,
      `WIS:${char.wis}`,
      `CHA:${char.cha}`,
      `CON:${char.con}`,
      `LUCK:${char.luck}`,
    ];
    const sum =
      char.str + char.dex + char.intt + char.wis + char.cha + char.con + char.luck;
    return `PC = (${parts.join(" + ")}) × LEVEL(${char.level}) = ${sum} × ${char.level} = ${computePC(char)}`;
  }, [char]);

  // Layout / estilos utilitários
  const asideWidth = narrow ? "100%" : (collapsed ? 56 : 300);
  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    padding: 12,
  };

  const asideStyle: React.CSSProperties = {
    order: narrow ? 2 : 0,
    flexBasis: narrow ? "100%" : undefined,
    width: asideWidth,
    background: "linear-gradient(180deg, rgba(6,10,20,.8), rgba(10,14,24,.8))",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: collapsed ? 8 : 12,
    position: "relative",
  };

  const cardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: 12,
  };

  const titleStyle: React.CSSProperties = {
    fontWeight: 700,
    opacity: 0.95,
    marginBottom: 8,
  };

  const badgeStyle: React.CSSProperties = {
    fontSize: 12,
    padding: "3px 8px",
    borderRadius: 999,
    background: "rgba(80,120,255,.15)",
    border: "1px solid rgba(80,120,255,.35)",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };

  const slotBase: React.CSSProperties = {
    height: 56,
    borderRadius: 10,
    background: "rgba(255,255,255,0.03)",
    border: "1px dashed rgba(255,255,255,0.16)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    color: "#aab",
  };

  return (
    <AuthGuard>
      <div style={containerStyle}>
        {/* SIDEBAR ESQUERDA - oculta na Arena */}
        {!isArena && (                                                    /* <-- ADICIONADO */
          <aside style={asideStyle}>
            {/* Botão colapsar */}
            <button
              aria-label="Minimizar"
              onClick={() => setCollapsed((v) => !v)}
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                height: 28,
                width: 28,
                borderRadius: 999,
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#ccd",
                fontSize: 14,
                cursor: "pointer",
              }}
              title={collapsed ? "Expandir painel" : "Minimizar painel"}
            >
              {collapsed ? "›" : "‹"}
            </button>

            {!collapsed && (
              <div style={{ display: "grid", gap: 12 }}>
                {/* Equipamentos */}
                <div style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h4 style={titleStyle}>Equipamentos</h4>
                    <span title={pcTooltip} style={badgeStyle}>
                      <strong>PC</strong> {pc}
                    </span>
                  </div>

                  {/* Grid de slots */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: 10,
                    }}
                  >
                    {/* topo */}
                    <button className="slot small" style={{ ...slotBase, gridColumn: "2 / span 1" }}>
                      Elmo
                    </button>

                    {/* coluna esquerda */}
                    <button className="slot" style={{ ...slotBase, gridColumn: "1 / span 1" }}>
                      Arma
                    </button>
                    <button className="slot" style={{ ...slotBase, gridColumn: "1 / span 1" }}>
                      Anel
                    </button>

                    {/* centro: avatar/peça principal */}
                    <div
                      style={{
                        gridColumn: "2 / span 1",
                        height: 112,
                        borderRadius: 12,
                        background: "rgba(255,255,255,0.02)",
                        border: "1px dashed rgba(255,255,255,0.18)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#789",
                        fontSize: 12,
                      }}
                    >
                      {char ? `${char.name} ${char.surname}` : "Sem personagem ativo"}
                    </div>

                    {/* coluna direita */}
                    <button className="slot" style={{ ...slotBase, gridColumn: "3 / span 1" }}>
                      Escudo
                    </button>
                    <button className="slot" style={{ ...slotBase, gridColumn: "3 / span 1" }}>
                      Peitoral
                    </button>

                    {/* linha de baixo */}
                    <button className="slot" style={{ ...slotBase, gridColumn: "2 / span 1" }}>
                      Calças
                    </button>
                    <button className="slot" style={{ ...slotBase, gridColumn: "3 / span 1" }}>
                      Botas
                    </button>
                  </div>
                </div>

                {/* Itens */}
                <div style={cardStyle}>
                  <h4 style={titleStyle}>Itens</h4>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, minmax(0,1fr))",
                      gap: 8,
                    }}
                  >
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} style={{ ...slotBase, height: 64 }} />
                    ))}
                  </div>
                </div>

                {/* Loja: NPC / Mercado */}
                <div style={cardStyle}>
                  <h4 style={titleStyle}>Loja</h4>

                  {shopView === null && (
                    <div style={{ display: "grid", gap: 8 }}>
                      <button
                        className="btn solid"
                        onClick={() => setShopView("npc")}
                        style={{
                          height: 42,
                          borderRadius: 10,
                          background: "rgba(100,140,255,.15)",
                          border: "1px solid rgba(100,140,255,.35)",
                          color: "#dfe6ff",
                        }}
                      >
                        Loja NPC
                      </button>
                      <button
                        className="btn solid"
                        onClick={() => setShopView("market")}
                        style={{
                          height: 42,
                          borderRadius: 10,
                          background: "rgba(150,255,200,.10)",
                          border: "1px solid rgba(150,255,200,.28)",
                          color: "#e6fff3",
                        }}
                      >
                        Mercado
                      </button>
                    </div>
                  )}

                  {shopView !== null && (
                    <div
                      style={{
                        marginTop: 8,
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 12,
                        padding: 10,
                        height: 360,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        overflow: "auto",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <strong>{shopView === "npc" ? "Loja NPC" : "Mercado"}</strong>
                        <button
                          className="btn ghost"
                          onClick={() => setShopView(null)}
                          style={{
                            height: 32,
                            padding: "0 10px",
                            borderRadius: 8,
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            color: "#cbd3ff",
                          }}
                        >
                          Voltar
                        </button>
                      </div>

                      {/* Placeholder do conteúdo de loja/ofertas */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                          gap: 8,
                        }}
                      >
                        {Array.from({ length: 12 }).map((_, i) => (
                          <div
                            key={i}
                            style={{
                              height: 76,
                              borderRadius: 10,
                              border: "1px dashed rgba(255,255,255,0.18)",
                              background: "rgba(255,255,255,0.02)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 12,
                              color: "#aab",
                            }}
                          >
                            {shopView === "npc" ? "Item NPC" : "Oferta"}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* rótulo pequeno quando colapsado */}
            {collapsed && (
              <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", color: "#aab", fontSize: 12, marginTop: 30 }}>
                Painel
              </div>
            )}
          </aside>
        )} {/* <-- FECHO DO CONDICIONAL */}

        {/* CONTEÚDO PRINCIPAL */}
        <div style={{ flex: "1 1 0", minWidth: 280 }}>{children}</div>
      </div>
    </AuthGuard>
  );
}
