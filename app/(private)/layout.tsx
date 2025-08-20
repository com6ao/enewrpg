"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGuard from "@/app/components/AuthGuard";

type EquipSlot =
  | "head" | "chest" | "legs" | "boots" | "weapon" | "offhand" | "ring" | "amulet";
type Equip = Partial<Record<EquipSlot, { name: string }>>;
type Item = { id: string; name: string; qty: number };
type Product = { id: string; name: string; price: number };

function useIsNarrow(bp = 960) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${bp}px)`);
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener?.("change", on);
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
  const [equip] = useState<Equip>({ head:{name:"Capuz de Couro"}, weapon:{name:"Espada"}, boots:{name:"Botas"} });
  const [items, setItems] = useState<Item[]>([
    { id:"pocao", name:"Poção de Vida", qty:3 },
    { id:"bomba", name:"Bomba", qty:1 }
  ]);
  const products: Product[] = useMemo(() => [
    { id:"kit1", name:"Kit de Cura", price:25 },
    { id:"escudo1", name:"Escudo Simples", price:80 },
  ], []);
  const onUse = (id: string) =>
    setItems(prev => prev.map(i => (i.id===id && i.qty>0 ? {...i, qty:i.qty-1} : i)).filter(i => i.qty>0));
  const onBuy = (id: string) => alert(`Comprar: ${id}`);

  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { if (localStorage.getItem("leftRailCollapsed")==="1") setCollapsed(true); }, []);
  useEffect(() => { localStorage.setItem("leftRailCollapsed", collapsed ? "1" : "0"); }, [collapsed]);

  const narrow = useIsNarrow(960);

  // **CORREÇÃO**: um único cálculo de largura/flex pra evitar props duplicadas
  const asidePx = collapsed ? 56 : 260;
  const asideFlex = narrow ? "1 1 100%" : `0 0 ${asidePx}px`;
  const asideWidth: number | string = narrow ? "100%" : asidePx;

  return (
    <AuthGuard>
      <main
        className="container"
        style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"flex-start" }}
      >
        <aside
          style={{
            flex: asideFlex,
            width: asideWidth,
            background:"#111",
            borderRadius:8,
            padding:10,
            order: narrow ? 2 : 0,             // cai abaixo no mobile
            flexBasis: narrow ? "100%" : undefined
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

        <div style={{ flex:"1 1 0", minWidth:0, order:1 }}>
          {children}
        </div>
      </main>
    </AuthGuard>
  );
}
