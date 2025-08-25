"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Page() {
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("Atualizando...");
    const { error } = await supabase.auth.updateUser({ password });
    setMsg(error ? error.message : "Senha atualizada. Você já pode entrar.");
  }

  return (
    <form onSubmit={onSubmit} style={{maxWidth:420}}>
      <h1>Definir nova senha</h1>
      <label>Nova senha<br/><input required type="password" value={password} onChange={e=>setPassword(e.target.value)} /></label><br/>
      <button type="submit">Salvar</button>
      <p>{msg}</p>
    </form>
  );
}
