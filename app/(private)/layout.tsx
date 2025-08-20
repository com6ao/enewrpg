"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGuard from "@/app/components/AuthGuard";

type EquipSlot =
  | "head" | "chest" | "legs" | "boots" | "weapon" | "offhand" | "ring" | "amulet";
type Equip = Partial<Record<EquipSlot, { name: string }>>;
type Item = { id: string; name: string; qty: number };
type Product = { id: string; name: string; price: number };

// Breakpoint p/ fazer a sidebar cair abaixo do conteúdo
function useIsNarrow(bp = 960) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${bp}px)`);
    const on = () => setNarrow(mq.matches);
    on(); mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, [bp]);
  return narrow;
}

function EquipmentCard({ equip }: { equip: Equip }) {
  const slots: { k: EquipSlot; label: string }[] = [
    { k: "head", label: "Elmo" }, { k: "chest", label: "Peitoral" },
    { k: "legs", label: "Calças" }, { k: "boots", label: "Botas" },
    { k: "weapon", label: "Arma" }, { k: "offhand", label: "Escudo" },
    { k: "ring", label: "Anel" }, { k: "amulet", label: "Amuleto" },
  ];
  return (
    <section className="card">
      <h3>Equipamentos</h3>
      <div className="grid-eq">
        {slots.map(s => (
          <div key={s.k} className="slot">
            <span className="muted">{equip[s.k]?.name ?? s.label}</span>
          </div>
        ))}
      </div>
      <style jsx>{`
        .grid-eq { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin-top:8px; }
        .slot { height:64px; border:1px dashed #333; border-radius:8px; display:flex; align-items:center; justify-content:center; background:#0c0c0c; }
      `}</style>
    </section>
  );
}

function InventoryCard({ items, onUse }: { items: Item[]; onUse: (id: string) => void }) {
  return (
    <section className="card">
      <h3>Itens</h3>
      <div className="list">
        {items.length === 0 && <div className="muted">Inventário vazio</div>}
        {items.map(it => (
          <div key={it.id} className="row">
            <div>{it.name} <span className="muted">x{it.qty}</span></div>
            <button className="btn" onClick={() => onUse(it.id)}>Usar</button>
          </div>
        ))}
      </div>
      <style jsx>{`
        .list { display:grid; gap:6px; margin-top:8px; }
        .row { display:flex; justify-content:space-between; align-items:center; padding:6px 8px; background:#0e0e0e; border-radius:6px; }
      `}</style>
    </section>
  );
}

function ShopCard({ products, onBuy }: { products: Product[]; onBuy: (id: string) => void }) {
  return (
    <section className="card">
      <h3>Loja</h3>
      <div className="list">
        {products.map(p => (
          <div key={p.id} className="row">
            <div>{p.name} <span className="muted">— {p.price}g</span></div>
            <button className="btn" onClick={() => onBuy(p.id)}>Comprar</button>
          </div>
        ))}
      </div>
      <style jsx>{`
        .list { display:grid; gap:6px; margin-top:8px; }
        .row { display:flex; justify-content:space-between; align-items:center; padding:6px 8px; background:#0e0e0e; border-radius:6px; }
      `}</style>
    </section>
  );
}

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  // mock simples (trocar depois por dados reais do usuário)
  const [equip] = useState<Equip>({ head:{name:"Capuz de Couro"}, weapon:{name:"Espada"}, boots:{name:"Botas"} });
  const [items, setItems] = useState<Item[]>([{ id:"pocao", name:"Poção de Vida", qty:3 }, { id:"bomba", name:"Bomba", qty:1 }]);
  const products: Product[] = useMemo(() => [
    { id:"kit1", name:"Kit de Cura", price:25 },
    { id:"escudo1", name:"Escudo Simples", price:80 },
  ], []);
  const onUse = (id: string) =>
    setItems(prev => prev.map(i => (i.id===id && i.qty>0 ? {...i, qty:i.qty-1} : i)).filter(i => i.qty>0));
  const onBuy = (id: string) => alert(`Comprar: ${id}`);

  // colapso com persistência
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { if (localStorage.getItem("leftRailCollapsed")==="1") setCollapsed(true); }, []);
  useEffect(() => { localStorage.setItem("leftRailCollapsed", collapsed ? "1" : "0"); }, [collapsed]);

  const narrow = useIsNarrow(960);

  return (
    <AuthGuard>
      <main
        className="container"
        style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"flex-start" }}
      >
        {/* Sidebar esquerda */}
        <aside
          style={{
            flex: collapsed ? "0 0 56px" : "0 0 260px",
            width: collapsed ? 56 : 260,
            background:"#111",
            borderRadius:8,
            padding:10,
            order: narrow ? 2 : 0,          // cai para baixo em telas estreitas
            flexBasis: narrow ? "100%" : undefined,
            width: narrow ? "100%" : (collapsed ? 56 : 260),
          }}
        >
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <h3 style={{ margin:0 }}>{collapsed ? "UI" : "Painel"}</h3>
            <button
              className="btn"
              onClick={() => setCollapsed(v => !v)}
              title={collapsed ? "Expandir" : "Minimizar"}
              style={{ padding:"4px 8px" }}
            >
              {collapsed ? "⮞" : "⮜"}
            </button>
          </div>

          {!collapsed && (
            <div style={{ display:"grid", gap:10, marginTop:10 }}>
              <EquipmentCard equip={equip} />
              <InventoryCard items={items} onUse={onUse} />
              <ShopCard products={products} onBuy={onBuy} />
            </div>
          )}
        </aside>

        {/* Conteúdo das páginas privadas */}
        <div style={{ flex:"1 1 0", minWidth:0, order:1 }}>
          {children}
        </div>
      </main>
    </AuthGuard>
  );
}
