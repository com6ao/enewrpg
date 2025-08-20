"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Nav() {
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Scroll control
  const scroller = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = () => {
    const el = scroller.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 0);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser();
      setUserEmail(data.user?.email ?? null);
    }
    load();
    updateArrows();
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => updateArrows();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateArrows);
    };
  }, [pathname]);

  async function logout() {
    await supabase.auth.signOut();
    location.href = "/login";
  }

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
    ["/register", "Registrar"], // 👈 sempre aparece
    ["/login", "Login"],        // 👈 sempre aparece
  ];

  const scrollBy = (px: number) =>
    scroller.current?.scrollBy({ left: px, behavior: "smooth" });

  return (
    <nav className="topnav" style={{ position: "relative", padding: "8px 44px" }}>
      {canLeft && (
        <button
          aria-label="rolar para a esquerda"
          onClick={() => scrollBy(-220)}
          style={arrowBtnStyle("left")}
        >
          ‹
        </button>
      )}
      {canRight && (
        <button
          aria-label="rolar para a direita"
          onClick={() => scrollBy(220)}
          style={arrowBtnStyle("right")}
        >
          ›
        </button>
      )}

      <div
        ref={scroller}
        className="no-scrollbar"
        style={{
          display: "flex",
          gap: 12,
          overflowX: "auto",
          whiteSpace: "nowrap",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href ? "page" : undefined}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              textDecoration: "none",
              color: pathname === href ? "#fff" : "#e5e7eb",
              background:
                pathname === href
                  ? "rgba(255,255,255,0.18)"
                  : "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            {label}
          </Link>
        ))}

        {userEmail && (
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "#fff",
            }}
          >
            <span>{userEmail}</span>
            <button
              aria-label="Sair"
              onClick={logout}
              style={{
                border: "1px solid rgba(255,255,255,0.2)",
                padding: "4px 10px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.1)",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Sair
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

function arrowBtnStyle(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute",
    top: "50%",
    [side]: 8,
    transform: "translateY(-50%)",
    height: 28,
    width: 28,
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.18)",
    color: "#fff",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    zIndex: 2,
  };
}
