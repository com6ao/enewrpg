"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Nav() {
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // detecta se o usuário está logado
  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser();
      setUserEmail(data.user?.email ?? null);
    }
    load();
  }, [pathname]);

  const links: [string, string][] = [
    ["/", "Início"],
    ["/dashboard", "Status"],
    ["/characters", "Personagens"],
    ["/missions", "Missões"],
    ["/arena", "Arena"],
    ["/adventure", "Aventura"],
    ["/skills", "Habilidades"],
    ["/shop", "Loja"],
    ["/rankings", "Rankings"],
    ["/forum", "Fórum"],
    ["/guild", "Organização"],
  ];

  async function logout() {
    await supabase.auth.signOut();
    location.href = "/login";
  }

  return (
    <nav className="topnav">
      {links.map(([href, label]) => (
        <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
          {label}
        </Link>
      ))}

      {/* se não logado → mostra Login / Registrar */}
      {!userEmail && (
        <>
          <Link href="/login" aria-current={pathname === "/login" ? "page" : undefined}>Login</Link>
          <Link href="/register" aria-current={pathname === "/register" ? "page" : undefined}>Registrar</Link>
        </>
      )}

      {/* se logado → mostra email + sair */}
      {userEmail && (
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span>{userEmail}</span>
          <button aria-label="Sair" className="btn" onClick={logout}>Sair</button>
        </span>
      )}
    </nav>
  );
}
