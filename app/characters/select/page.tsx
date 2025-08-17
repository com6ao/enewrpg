import Link from 'next/link';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export default async function SelectCharacter(){
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n:string)=>cookieStore.get(n)?.value } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if(!user) return <div className="container">Faça login.</div>;

  const { data: chars } = await supabase
    .from('characters')
    .select('id,name,surname,universe,energy,level,str,dex,intt,wis,cha,con')
    .eq('user_id', user.id)
    .order('created_at', { ascending:false });

  return (
    <div className="container">
      <h1>Selecionar personagem</h1>
      <div className="grid-cards">
        {(chars??[]).map(c=>(
          <div key={c.id} className="card">
            <div className="card-title">{c.name} {c.surname}</div>
            <div className="card-desc">{c.universe} • {c.energy} • Nível {c.level}</div>
            <div className="muted">FOR {c.str} | DES {c.dex} | INT {c.intt} | SAB {c.wis} | CAR {c.cha} | CON {c.con}</div>
            <Link href="/" className="btn" style={{display:'inline-block',marginTop:8}}>Entrar</Link>
          </div>
        ))}
      </div>
      <div style={{marginTop:16}}>
        <Link href="/characters/new" className="btn">Criar novo</Link>
      </div>
    </div>
  );
}

