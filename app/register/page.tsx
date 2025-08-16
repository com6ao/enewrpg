"use client";

import type { Metadata } from "next";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export const metadata: Metadata = { title: "Registrar — enewRPG" };

export default function Page() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("Criando conta...");
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/` },
    });
    if (error) { setMsg(error.message); return; }
    // Se confirmação de e-mail estiver ativa, o usuário deve confirmar
    if (data?.user && !data.user.email_confirmed_at) {
      setMsg("Verifique seu e-mail para confirmar a conta.");
      return;
    }
    setMsg("Conta criada.");
    router.push("/dashboard");
  }

  return (
    <form onSubmit={onSubmit} style={{maxWidth:420}}>
      <h1>Registrar</h1>
      <label>Email<br/><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} /></label><br/>
      <label>Senha<br/><input required type="password" value={password} onChange={e=>setPassword(e.target.value)} /></label><br/>
      <button type="submit">Criar conta</button>
      <p>{msg}</p>
    </form>
  );
}
