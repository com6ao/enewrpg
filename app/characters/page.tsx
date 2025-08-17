// app/characters/page.tsx
export default function CharactersIndex(){
  return (
    <main className="container">
      <h1>Criar/Selecionar Personagem</h1>
      <div className="card" style={{display:'flex',gap:12}}>
        <a className="btn" href="/characters/new">Criar</a>
        <a className="btn" href="/characters/select">Selecionar</a>
      </div>
    </main>
  );
}
