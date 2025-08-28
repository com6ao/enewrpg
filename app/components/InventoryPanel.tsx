"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Character } from "@/types/character";
import type { GearItem } from "@/types/gear";


export default function InventoryPanel({ mode = "sidebar" }: { mode?: "sidebar" | "modal" }) {
  const [shopView, setShopView] = useState<null | "npc" | "market">(null);
  const [char, setChar] = useState<Character | null>(null);
  const [loadingChar, setLoadingChar] = useState(true);
  const [items, setItems] = useState<GearItem[]>([]);
  const [drops, setDrops] = useState<GearItem[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user;
        if (!user) return;

        const { data: profile } = await supabase
          .from("profiles").select("active_character_id").eq("id", user.id).maybeSingle();

        if (!profile?.active_character_id) return;

        const { data: personagem } = await supabase
          .from("characters")
          .select("id,name,surname,level,xp,str,dex,intt,wis,cha,con,luck")
          .eq("id", profile.active_character_id).maybeSingle();

        setChar(personagem as Character | null);
      } finally { setLoadingChar(false); }
    })();
  }, []);

  useEffect(() => {
    if (!char) return;
    (async () => {
      const { data: owned } = await supabase
        .from("gear_items")
        .select("*")
        .eq("character_id", char.id);
      setItems((owned as GearItem[]) || []);

      const { data: recent } = await supabase
        .from("gear_items")
        .select("*")
        .is("character_id", null)
        .order("id", { ascending: false })
        .limit(10);
      setDrops((recent as GearItem[]) || []);
    })();
  }, [char]);

  const pc = useMemo(() => {
    if (!char) return 0;
    const sum = char.str + char.dex + char.intt + char.wis + char.cha + char.con + char.luck;
    return sum * Math.max(1, char.level);
  }, [char]);

  const pcTooltip = useMemo(() => {
    if (!char) return "PC: requer personagem ativo.\nFórmula: (STR+DEX+INT+WIS+CHA+CON+LUCK) × LEVEL";
    const parts = [`STR:${char.str}`,`DEX:${char.dex}`,`INT:${char.intt}`,`WIS:${char.wis}`,`CHA:${char.cha}`,`CON:${char.con}`,`LUCK:${char.luck}`];
    const sum = char.str+char.dex+char.intt+char.wis+char.cha+char.con+char.luck;
    return `PC = (${parts.join(" + ")}) × LEVEL(${char.level}) = ${sum} × ${char.level} = ${sum*char.level}`;
  }, [char]);

  const wrap: React.CSSProperties = mode==="modal"
    ? { width:"min(720px,92vw)" }
    : {};

  const card: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: 12,
  };
  const title: React.CSSProperties = { fontWeight: 700, opacity: .95, marginBottom: 8 };
  const slotBase: React.CSSProperties = {
    height: 56, borderRadius: 10, background: "rgba(255,255,255,0.03)",
    border: "1px dashed rgba(255,255,255,0.16)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 12, color: "#aab"
  };
  const badge: React.CSSProperties = {
    fontSize: 12, padding:"3px 8px", borderRadius:999,
    background:"rgba(80,120,255,.15)", border:"1px solid rgba(80,120,255,.35)",
    display:"inline-flex", alignItems:"center", gap:6
  };

  const rarityColors: Record<string, string> = {
    common: "#bbb",
    uncommon: "#4ade80",
    rare: "#60a5fa",
    epic: "#c084fc",
    legendary: "#f59e0b",
  };

  const equip = async (item: GearItem) => {
    if (!char) return;
    await supabase
      .from("gear_equipped")
      .upsert({ character_id: char.id, slot: item.slot, gear_item_id: item.id });
    await supabase
      .from("gear_items")
      .update({ character_id: char.id })
      .eq("id", item.id);
    setDrops(drops.filter(d => d.id !== item.id));
    setItems([...items, { ...item, character_id: char.id }]);
  };

  return (
    <div style={{ display:"grid", gap:12, ...wrap }}>
      <div style={card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <h4 style={title}>Equipamentos</h4>
          <span title={pcTooltip} style={badge}><strong>PC</strong> {pc}</span>
        </div>

        <div style={{
          display:"grid",
          gridTemplateColumns:"1fr 1fr 1fr",
          gridTemplateRows:"repeat(4,56px)",
          gridTemplateAreas:`
            " . helmet . "
            "weapon char shield"
            "ring char chest"
            " . pants boots"
          `,
          gap:10,
        }}>
          <button style={{ ...slotBase, gridArea:"helmet" }}>Elmo</button>
          <button style={{ ...slotBase, gridArea:"weapon" }}>Arma</button>
          <button style={{ ...slotBase, gridArea:"ring" }}>Anel</button>
          <div style={{
            gridArea:"char", height:112, borderRadius:12,
            background:"rgba(255,255,255,0.02)", border:"1px dashed rgba(255,255,255,0.18)",
            display:"flex", alignItems:"center", justifyContent:"center", color:"#789", fontSize:12
          }}>
            {char ? `${char.name} ${char.surname}` : "Sem personagem ativo"}
          </div>
          <button style={{ ...slotBase, gridArea:"shield" }}>Escudo</button>
          <button style={{ ...slotBase, gridArea:"chest" }}>Peitoral</button>
          <button style={{ ...slotBase, gridArea:"pants" }}>Calças</button>
          <button style={{ ...slotBase, gridArea:"boots" }}>Botas</button>
        </div>
      </div>

      <div style={card}>
        <h4 style={title}>Itens</h4>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,minmax(0,1fr))", gap:8 }}>
          {items.length>0 ? (
            items.map(it => {
              const c = rarityColors[it.rarity] || "#fff";
              return (
                <div key={it.id} style={{
                  ...slotBase,
                  height:"auto",
                  padding:6,
                  border:`1px solid ${c}`,
                  color:c,
                  flexDirection:"column",
                  alignItems:"flex-start",
                }}>
                  <strong style={{ textTransform:"capitalize" }}>{it.slot}</strong>
                  {it.base && <span>{it.base.stat}: {it.base.value}</span>}
                  {it.substats?.map((s,i)=>(
                    <span key={i} style={{ fontSize:11 }}>{s.stat}: {s.value}</span>
                  ))}
                </div>
              );
            })
          ) : (
            Array.from({length:6}).map((_,i)=>(<div key={i} style={{ ...slotBase, height:64 }}/>))
          )}
        </div>
      </div>

      {mode==="modal" && (
        <div style={card}>
          <h4 style={title}>Drops recentes</h4>
          <div style={{ display:"grid", gap:8 }}>
            {drops.map(it => {
              const c = rarityColors[it.rarity] || "#fff";
              return (
                <div key={it.id} style={{
                  ...slotBase,
                  height:"auto",
                  padding:8,
                  border:`1px solid ${c}`,
                  color:c,
                  flexDirection:"column",
                  alignItems:"flex-start",
                  gap:2,
                }}>
                  <strong style={{ textTransform:"capitalize" }}>{it.slot}</strong>
                  {it.base && <span>{it.base.stat}: {it.base.value}</span>}
                  {it.substats?.map((s,i)=>(
                    <span key={i} style={{ fontSize:11 }}>{s.stat}: {s.value}</span>
                  ))}
                  <button onClick={()=>equip(it)} style={{
                    marginTop:4,
                    alignSelf:"flex-end",
                    padding:"2px 6px",
                    borderRadius:6,
                    background:"rgba(255,255,255,0.06)",
                    border:"1px solid rgba(255,255,255,0.12)",
                    color:"#cbd3ff",
                    fontSize:12,
                  }}>Equipar</button>
                </div>
              );
            })}
            {drops.length===0 && (
              <div style={{ ...slotBase, height:64 }}>Sem drops</div>
            )}
          </div>
        </div>
      )}

      <div style={card}>
        <h4 style={title}>Loja</h4>
        {shopView===null ? (
          <div style={{ display:"grid", gap:8 }}>
            <button onClick={()=>setShopView("npc")}  style={{ height:42, borderRadius:10, background:"rgba(100,140,255,.15)", border:"1px solid rgba(100,140,255,.35)", color:"#dfe6ff" }}>Loja NPC</button>
            <button onClick={()=>setShopView("market")} style={{ height:42, borderRadius:10, background:"rgba(150,255,200,.10)", border:"1px solid rgba(150,255,200,.28)", color:"#e6fff3" }}>Mercado</button>
          </div>
        ) : (
          <div style={{ marginTop:8, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:12, padding:10, maxHeight: mode==="modal"? 360 : 360, overflow:"auto", display:"grid", gap:8 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <strong>{shopView==="npc"?"Loja NPC":"Mercado"}</strong>
              <button onClick={()=>setShopView(null)} style={{ height:32, padding:"0 10px", borderRadius:8, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", color:"#cbd3ff" }}>Voltar</button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,minmax(0,1fr))", gap:8 }}>
              {Array.from({length:12}).map((_,i)=>(
                <div key={i} style={{ height:76, borderRadius:10, border:"1px dashed rgba(255,255,255,0.18)", background:"rgba(255,255,255,0.02)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, color:"#aab" }}>
                  {shopView==="npc"?"Item NPC":"Oferta"}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
