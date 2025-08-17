'use client';
import { useState } from 'react';
import { ALL_SURNAMES } from '../../../lib/rules';

export default function NewCharacterPage(){
  const [name, setName] = useState('');
  const [surname, setSurname] = useState<string>(ALL_SURNAMES[0]);
  const [pts, setPts] = useState(20);
  const [attr, setAttr] = useState({str:0,dex:0,intt:0,wis:0,cha:0,con:0});

  const rows = [
    ['Força','str'],['Destreza','dex'],['Inteligência','intt'],
    ['Sabedoria','wis'],['Carisma','cha'],['Constituição','con'],
  ] as const;

  function inc(k: keyof typeof attr){ if(pts>0){ setAttr(a=>({...a,[k]:a[k]+1})); setPts(p=>p-1); } }
  function dec(k: keyof typeof attr){ if(attr[k]>0){ setAttr(a=>({...a,[k]:a[k]-1})); setPts(p=>p+1); } }

  async function submit(){
    const r = await fetch('/api/characters/create',{ method:'POST', body: JSON.stringify({ name, surname, attrs: attr }) });
    if(!r.ok){ alert(await r.text()); return; }
    location.href = '/characters/select';
  }

  return (
    <div className="container">
      <h1>Criar personagem</h1>
      <div className="card" style={{display:'grid',gap:12}}>
        <label className="field">
          <span>Nome</span>
          <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="nome único" />
        </label>

        <label className="field">
          <span>Sobrenome</span>
          <select className="input" value={surname} onChange={e=>setSurname(e.target.value)}>
            {ALL_SURNAMES.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </label>

        <div className="muted">Pontos: {pts}</div>

        <div className="grid-cards">
          {rows.map(([label,key])=>(
            <div key={key} className="card" style={{display:'grid',gridTemplateColumns:'1fr auto 24px auto',gap:8,alignItems:'center'}}>
              <div className="card-title">{label}</div>
              <button className="btn" onClick={()=>dec(key)}> - </button>
              <div style={{textAlign:'center'}}>{attr[key]}</div>
              <button className="btn" onClick={()=>inc(key)}> + </button>
            </div>
          ))}
        </div>

        <button className="btn" onClick={submit} disabled={!name || pts!==0}>Criar</button>
      </div>
    </div>
  );
}

