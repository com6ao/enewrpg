import Link from "next/link";

const links = [
  ["/","Início"],["/login","Login"],["/register","Registrar"],
  ["/dashboard","Status"],["/characters","Personagens"],["/missions","Missões"],
  ["/arena","Arena"],["/adventure","Aventura"],["/skills","Habilidades"],
  ["/shop","Loja"],["/rankings","Rankings"],["/forum","Fórum"],["/guild","Organização"],
];

export default function Nav() {
  return (
    <nav style={{display:"grid",gridAutoFlow:"column",gap:12,overflowX:"auto",padding:"12px 16px",borderBottom:"1px solid #eee"}}>
      {links.map(([href,label]) => (
        <Link key={href} href={href} style={{whiteSpace:"nowrap"}}>{label}</Link>
      ))}
    </nav>
  );
}
