"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import Link from "next/link";
// ...
<p><Link href="/forgot">Esqueci minha senha</Link></p>


export default function Page() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("Entrando...");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setMsg(error.message); return; }
    router.push("/dashboard");
  }
  
  return (
    <form onSubmit={onSubmit} style={{maxWidth:420}}>
      <h1>Login</h1>
      <label>Email<br/><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} /></label><br/>
      <label>Senha<br/><input required type="password" value={password} onChange={e=>setPassword(e.target.value)} /></label><br/>
      <button type="submit">Entrar</button>
      <p>{msg}</p>
    </form>
  );
}
