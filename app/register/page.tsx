"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function Page() {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  const [msg,setMsg]=useState<string|null>(null); const router=useRouter();

  async function onSubmit(e:React.FormEvent){ e.preventDefault();
    setMsg("Criando conta...");
    const { data, error } = await supabase.auth.signUp({
      email, password, options:{ emailRedirectTo: `${location.origin}/` }
    });
    if(error){ setMsg(error.message); return; }
    if(data?.user && !data.user.email_confirmed_at){ setMsg("Verifique seu e-mail."); return; }
    router.push("/dashboard");
  }

  return (
    <div className="card" style={{maxWidth:480}}>
      <h1>Registrar</h1>
      <form onSubmit={onSubmit} className="form">
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" required
                 value={email} onChange={e=>setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input id="password" className="input" type="password" required
                 value={password} onChange={e=>setPassword(e.target.value)} />
        </div>
        <button className="btn" type="submit">Criar conta</button>
      </form>
      <p className="muted" style={{marginTop:8}}>{msg}</p>
    </div>
  );
}
