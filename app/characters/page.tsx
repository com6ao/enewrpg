// app/characters/page.tsx
import Link from 'next/link';

export default function CharactersIndex() {
  return (
    <main className="container">
      <h1>Criar/Selecionar Personagem</h1>
      <div className="card" style={{ display: 'flex', gap: 12 }}>
        <Link className="btn" href="/characters/new">Criar</Link>
        <Link className="btn" href="/characters/select">Selecionar</Link>
      </div>
    </main>
  );
}
