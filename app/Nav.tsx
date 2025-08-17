"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["/","Início"],["/login","Login"],["/register","Registrar"],
  ["/dashboard","Status"],["/characters","Personagens"],["/missions","Missões"],
  ["/arena","Arena"],["/adventure","Aventura"],["/skills","Habilidades"],
  ["/shop","Loja"],["/rankings","Rankings"],["/forum","Fórum"],["/guild","Organização"],
];

export default function Nav(){
  const pathname = usePathname();
  return (
    <nav className="topnav">
      {links.map(([href,label]) => (
        <Link key={href} href={href} aria-current={pathname===href ? "page" : undefined}>{label}</Link>
      ))}
    </nav>
  );
}
