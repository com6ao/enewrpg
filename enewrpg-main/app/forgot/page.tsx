"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Page() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("Enviando...");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/reset-password`,
    });
    setMsg(error ? error.message : "Se existir conta, enviamos o e-mail.");
  }

  return (
    <form onSubmit={onSubmit} style={{maxWidth:420}}>
      <h1>Recuperar senha</h1>
      <label>Email<br/><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} /></label><br/>
      <button type="submit">Enviar link</button>
      <p>{msg}</p>
    </form>
  );
}
