import Link from "next/link";

const cards = [
  {href:"/characters", title:"Personagens", desc:"Crie e selecione seu personagem"},
  {href:"/missions", title:"Missões", desc:"Missões diárias e história"},
  {href:"/arena", title:"Arena", desc:"Combates PvE simples"},
  {href:"/adventure", title:"Aventura", desc:"Capítulos lineares"},
  {href:"/skills", title:"Habilidades", desc:"Treino e upgrades"},
  {href:"/shop", title:"Loja", desc:"Itens e consumíveis"},
  {href:"/rankings", title:"Rankings", desc:"Top jogadores"},
  {href:"/forum", title:"Fórum", desc:"Discussões"},
];

export default function Page() {
  return (
    <div>
      <h1>enewRPG — Início</h1>
      <div className="grid-cards">
        {cards.map(c=>(
          <Link key={c.href} href={c.href} className="card" style={{display:"block",textDecoration:"none"}}>
            <div className="card-title">{c.title}</div>
            <div className="card-desc">{c.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
