"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/app/components/AuthGuard";

/* ---------------------------- Tipos de Equipamentos ---------------------------- */
type EquipSlot =
  | "head"
  | "amulet"
  | "weapon"
  | "offhand"
  | "ring"
  | "chest"
  | "legs"
  | "boots";

type Equip = {
  [K in EquipSlot]?: { name: string; rarity?: "common" | "rare" | "epic" };
};

/* ------------------------------- Cards auxiliares ------------------------------- */

function ItemsCard() {
  return (
    <section className="card" style={{ padding: 12 }}>
      <h3 style={{ marginBottom: 8 }}>Itens</h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 8,
        }}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            title="Vazio"
            style={{
              height: 54,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,.06)",
              background:
                "linear-gradient(180deg, rgba(31,41,55,.55), rgba(17,24,39,.55))",
              boxShadow:
                "0 1px 0 rgba(255,255,255,.04) inset, 0 6px 12px rgba(0,0,0,.25)",
            }}
          />
        ))}
      </div>
    </section>
  );
}

function ShopCard() {
  return (
    <section className="card" style={{ padding: 12 }}>
      <h3 style={{ marginBottom: 8 }}>Loja</h3>
      <div style={{ display: "grid", gap: 8 }}>
        <button className="btn">Loja NPC</button>
        <button className="btn" style={{ background: "#3b82f6" }}>
          Mercado
        </button>
      </div>
    </section>
  );
}

/* --------------------------- Card de Equipamentos (novo) --------------------------- */

function EquipmentCard({ equip }: { equip: Equip }) {
  // ordem e posição dos slots ao redor do avatar
  const slots: { k: EquipSlot; label: string; area: string }[] = [
    { k: "head", label: "Elmo", area: "head" },
    { k: "amulet", label: "Amuleto", area: "amulet" },
    { k: "weapon", label: "Arma", area: "weapon" },
    { k: "chest", label: "Peitoral", area: "chest" },
    { k: "offhand", label: "Escudo", area: "off" },
    { k: "ring", label: "Anel", area: "ring" },
    { k: "legs", label: "Calças", area: "legs" },
    { k: "boots", label: "Botas", area: "boots" },
  ];

  return (
    <section className="card eq-card">
      <div className="eq-header">
        <h3>Equipamentos</h3>
        <span className="badge">CB 4276</span>
      </div>

      <div className="eq-grid">
        {/* Avatar */}
        <div className="avatar" aria-hidden>
          <div className="silhouette" />
        </div>

        {/* Slots */}
        {slots.map((s) => (
          <button key={s.k} className={`slot ${s.area}`} title={s.label}>
            <span className="slot-title">{equip[s.k]?.name ?? s.label}</span>
          </button>
        ))}
      </div>

      {/* estilos locais do card */}
      <style jsx>{`
        .eq-card {
          padding: 12px;
          backdrop-filter: blur(6px);
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.04),
            rgba(0, 0, 0, 0.15)
          );
          border: 1px solid rgba(255, 255, 255, 0.06);
        }
        .eq-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 10px;
        }
        .badge {
          font-size: 12px;
          padding: 2px 8px;
          border-radius: 999px;
          background: #1f2937;
          color: #e5e7eb;
          border: 1px solid #2b3442;
        }
        .eq-grid {
          display: grid;
          grid-template-areas:
            ".      head    amulet   .     "
            "weapon avatar  avatar   off   "
            "ring   avatar  avatar   chest "
            ".      legs    boots    .     ";
          grid-template-columns: repeat(4, 1fr);
          grid-template-rows: 56px 72px 72px 56px;
          gap: 8px;
        }
        .avatar {
          grid-area: avatar;
          position: relative;
          border-radius: 12px;
          background: radial-gradient(
            120px 140px at 50% 20%,
            rgba(255, 255, 255, 0.06),
            rgba(0, 0, 0, 0.2)
          );
          border: 1px solid rgba(255, 255, 255, 0.06);
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 140px;
        }
        .silhouette {
          width: 60%;
          height: 80%;
          border-radius: 8px;
          background: linear-gradient(180deg, #1f2937 20%, #0f172a 100%);
          mask: radial-gradient(circle at 50% 15%, transparent 22%, black 23%)
              top/100% 30% no-repeat,
            linear-gradient(transparent 38%, black 39%) center/100% 100%
              no-repeat;
          opacity: 0.6;
        }
        .slot {
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          background: linear-gradient(
            180deg,
            rgba(31, 41, 55, 0.55),
            rgba(17, 24, 39, 0.55)
          );
          color: #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px;
          transition: transform 0.12s ease, box-shadow 0.12s ease,
            border-color 0.12s ease;
          box-shadow: 0 1px 0 rgba(255, 255, 255, 0.04) inset,
            0 6px 12px rgba(0, 0, 0, 0.25);
        }
        .slot:hover {
          transform: translateY(-1px);
          border-color: #3b82f6;
          box-shadow: 0 8px 18px rgba(59, 130, 246, 0.12);
        }
        .slot-title {
          font-size: 12px;
          text-align: center;
          line-height: 1.1;
        }
        .head {
          grid-area: head;
        }
        .amulet {
          grid-area: amulet;
        }
        .weapon {
          grid-area: weapon;
        }
        .off {
          grid-area: off;
        }
        .ring {
          grid-area: ring;
        }
        .chest {
          grid-area: chest;
        }
        .legs {
          grid-area: legs;
        }
        .boots {
          grid-area: boots;
        }

        @media (max-width: 640px) {
          .eq-grid {
            grid-template-areas:
              "head   amulet  weapon  off"
              "ring   chest   legs    boots"
              "avatar avatar  avatar  avatar";
            grid-template-rows: 56px 56px 160px;
          }
          .avatar {
            min-height: 160px;
          }
        }
      `}</style>
    </section>
  );
}

/* ---------------------------------- Layout ---------------------------------- */

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 1024);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // largura calculada da sidebar
  const sidebarWidth = narrow ? "100%" : collapsed ? 56 : 260;

  return (
    <AuthGuard>
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        {/* SIDEBAR (esquerda; cai para baixo no mobile) */}
        <aside
          style={{
            order: narrow ? 2 : 0,
            flex: narrow ? "1 1 100%" : "0 0 auto",
            width: sidebarWidth,
            maxWidth: sidebarWidth,
            background:
              "linear-gradient(180deg, rgba(2,6,23,.8), rgba(2,6,23,.5))",
            border: "1px solid rgba(148,163,184,.08)",
            boxShadow: "0 10px 30px rgba(0,0,0,.25)",
            borderRadius: 10,
            padding: 10,
            position: narrow ? "relative" : "sticky",
            top: narrow ? undefined : 12,
          }}
        >
          {/* header da sidebar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <strong style={{ opacity: 0.9 }}>Painel</strong>
            <button
              className="btn"
              onClick={() => setCollapsed((v) => !v)}
              title={collapsed ? "Expandir" : "Minimizar"}
              style={{ padding: "4px 8px" }}
            >
              {collapsed ? "⟩" : "⟨"}
            </button>
          </div>

          {/* conteúdo da sidebar (mostra/oculta quando colapsa) */}
          {!collapsed && (
            <div style={{ display: "grid", gap: 10 }}>
              <EquipmentCard
                equip={{
                  head: { name: "Elmo Comum" },
                  weapon: { name: "Espada" },
                  chest: { name: "Peitoral" },
                }}
              />
              <ItemsCard />
              <ShopCard />
            </div>
          )}
        </aside>

        {/* CONTEÚDO principal */}
        <main
          style={{
            order: 1,
            flex: "1 1 0",
            minWidth: 0,
          }}
        >
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
