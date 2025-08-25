"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function Page() {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  const [msg,setMsg]=useState<string|null>(null); const router=useRouter();

  async function onSubmit(e:React.FormEvent){ e.preventDefault();
    setMsg("Entrando...");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if(error){ setMsg(error.message); return; }
    router.push("/dashboard");
  }

  return (
    <div className="card" style={{maxWidth:480}}>
      <h1>Login</h1>
      <form onSubmit={onSubmit} className="form">
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="email"
                 required value={email} onChange={e=>setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input id="password" className="input" type="password" autoComplete="current-password"
                 required value={password} onChange={e=>setPassword(e.target.value)} />
        </div>
        <button className="btn" type="submit">Entrar</button>
      </form>
      <p className="muted" style={{marginTop:8}}>{msg}</p>
      <p style={{marginTop:8}}><Link href="/forgot">Esqueci minha senha</Link></p>
    </div>
  );
}
