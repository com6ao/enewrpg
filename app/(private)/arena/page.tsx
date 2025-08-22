"use client";
import { useEffect, useRef, useState } from "react";

type Snap = {
  player: { name:string; hp:number; hpMax:number; mp:number; mpMax:number; atb:number; nextIcon?:string; level:number };
  enemy:  { name:string; hp:number; hpMax:number; mp:number; mpMax:number; atb:number; nextIcon?:string; level:number };
  log: { text:string; side:"neutral"|"player"|"enemy" }[];
  calc: { text:string; side:"player"|"enemy" }[];
};
type StartResp = { id:string; snap:Snap };
type StepResp  = { id:string; snap:Snap; lines:any[]; status:"active"|"finished"; winner:null|"player"|"enemy"|"draw"; cursor:number };

export default function ArenaPage(){
  const [id,setId]=useState<string|null>(null);
  const [snap,setSnap]=useState<Snap|null>(null);
  const [lines,setLines]=useState<any[]>([]);
  const [auto,setAuto]=useState(true);
  const [busy,setBusy]=useState(false);
  const timer=useRef<NodeJS.Timeout|null>(null);

  useEffect(()=>()=>{ if(timer.current) clearTimeout(timer.current); },[]);

  async function start(){
    setBusy(true); setLines([]); setSnap(null); setId(null);
    const r = await fetch("/api/arena",{ method:"POST", body:JSON.stringify({op:"start"}) });
    if(!r.ok){ alert(await r.text()); setBusy(false); return; }
    const data = (await r.json()) as StartResp;
    setId(data.id); setSnap(data.snap); setBusy(false);
    if(auto) stepLoop(data.id);
  }

  async function stepOnce(arenaId:string){
    const r = await fetch("/api/arena",{ method:"POST", body:JSON.stringify({op:"step", id:arenaId}) });
    if(!r.ok){ alert(await r.text()); return null; }
    return (await r.json()) as StepResp;
  }

  async function stepLoop(arenaId:string){
    if(timer.current) clearTimeout(timer.current);
    const res = await stepOnce(arenaId);
    if(!res) return;
    setSnap(res.snap);
    setLines(p=>[...p, ...res.lines]);
    if(res.status==="finished") return;
    if(auto) timer.current=setTimeout(()=>stepLoop(arenaId), 550);
  }

  function bar(curr:number,max:number){ const w=Math.max(0,Math.min(100,Math.round((curr/max)*100))); return (
    <div style={{height:10,background:"#222",borderRadius:6,overflow:"hidden"}}>
      <div style={{width:`${w}%`,height:"100%",background:"#2ecc71"}} />
    </div>);
  }

  return (
    <main style={{maxWidth:1120,margin:"0 auto",padding:16,display:"grid",gap:12}}>
      <header style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <h1 style={{fontSize:24}}>Arena</h1>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <label style={{display:"flex",alignItems:"center",gap:6}}>
            <input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)} />
            Auto
          </label>
          <button className="btn" disabled={busy} onClick={start} style={{padding:"8px 12px",borderRadius:8,background:"#2ecc71"}}>Lutar</button>
        </div>
      </header>

      {snap ? (
        <section style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div style={{background:"#0b0b0b",border:"1px solid #1e1e1e",borderRadius:12,padding:12}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <strong>Você</strong><span>Lv {snap.player.level}</span>
            </div>
            {bar(snap.player.hp,snap.player.hpMax)}
            <div style={{fontSize:12,opacity:.8,marginTop:6}}>HP {snap.player.hp}/{snap.player.hpMax}</div>
          </div>
          <div style={{background:"#0b0b0b",border:"1px solid #1e1e1e",borderRadius:12,padding:12}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <strong>{snap.enemy.name}</strong><span>Lv {snap.enemy.level}</span>
            </div>
            {bar(snap.enemy.hp,snap.enemy.hpMax)}
            <div style={{fontSize:12,opacity:.8,marginTop:6}}>HP {snap.enemy.hp}/{snap.enemy.hpMax}</div>
          </div>
        </section>
      ):(
        <div style={{opacity:.8}}>Clique em Lutar.</div>
      )}

      <section style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:12}}>
        <div style={{background:"#0b0b0b",border:"1px solid #1e1e1e",borderRadius:12,padding:12,maxHeight:280,overflow:"auto"}}>
          {(snap?.log ?? []).map((l,i)=>(
            <div key={i} style={{padding:"6px 4px",borderBottom:"1px solid #151515"}}>{l.text}</div>
          ))}
          {lines.map((l,i)=>(<div key={`n-${i}`} style={{padding:"6px 4px",borderBottom:"1px solid #151515",opacity:.9}}>{typeof l==="string"?l:l.text??JSON.stringify(l)}</div>))}
        </div>
        <aside style={{background:"#0b0b0b",border:"1px solid #1e1e1e",borderRadius:12,padding:12}}>
          <h3 style={{marginBottom:8,fontWeight:600}}>Cálculos</h3>
          <div style={{fontSize:12,maxHeight:280,overflow:"auto"}}>
            {(snap?.calc ?? []).map((c,i)=>(<div key={i} style={{borderBottom:"1px solid #151515",padding:"4px 2px"}}>{c.text}</div>))}
          </div>
        </aside>
      </section>

      {id && snap && (
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>stepLoop(id)} disabled={!id || !snap} style={{padding:"8px 12px",borderRadius:8,background:"#1f2937"}}>Próximo turno</button>
        </div>
      )}
    </main>
  );
}
