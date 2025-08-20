"use client";

import { useState } from "react";
import { ALL_SURNAMES } from "@/lib/races";

export default function NewCharacterPage() {
  const [name, setName]       = useState("");
  const [surname, setSurname] = useState(ALL_SURNAMES[0]);
  const [pts, setPts]         = useState(20);

  const [attr, setAttr] = useState({
    str:10, dex:10, intt:10, wis:10, cha:10, con:10, luck:10
  });

  const rows = [
    ['Força','str'],['Destreza','dex'],['Inteligência','intt'],
    ['Sabedoria','wis'],['Carisma','cha'],['Constituição','con'],
    ['Sorte','luck'],
  ];

  function inc(c:keyof typeof attr){ if(pts>0){ setAttr({ ...attr,[c]:attr[c]+1}); setPts(pts-1);} }
  function dec(c:keyof typeof attr){ if(attr[c]>0){ setAttr({ ...attr,[c]:attr[c]-1}); setPts(pts+1);} }

  async function submit(){
    const r = await fetch("/api/characters/create",{
      method:"POST",
      body: JSON.stringify({ name, surname, attrs: attr })
    });
    if(!r.ok) return alert("Erro!");
    location.href="/characters/select";
  }

  return (
    <div className="container">
      <h1>Criar personagem</h1>
      <div className="grid" style={{display:'grid',gap:'2rem'}}>
        <label className="field">
          <span>Nome</span>
          <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="nome único" />
        </label>
        <label className="field">
          <span>Sobrenome</span>
          <select className="input" value={surname} onChange={e=>setSurname(e.target.value)}>
            {ALL_SURNAMES.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>

        <div className="mb-6">Pontos distribuíveis: {pts}</div>
        <div className="grid" style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:'1rem'}}>
          {rows.map(([label,key])=>(
            <div key={key} className="card" style={{padding:'1rem',textAlign:'center'}}>
              <div className="card-title">{label}</div>
              <button className="btn" onClick={()=>dec(key as any)}>-</button>
              <span style={{margin:'0 .5rem'}}>{attr[key as keyof typeof attr]}</span>
              <button className="btn" onClick={()=>inc(key as any)}>+</button>
            </div>
          ))}
        </div>
      </div>

      <button className="btn" onClick={submit} disabled={!name || pts!==0}>Criar</button>
    </div>
  );
}
