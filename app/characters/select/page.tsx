// app/characters/select/page.tsx
import Link from 'next/link';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const metadata = { title: 'Selecionar Personagem — enewRPG' };

export default async function SelectCharactersPage() {
  const cookieStore = await cookies(); // <- precisa de await no Next 15

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options?: any) {
          cookieStore.set({ name, value, ...(options || {}) });
        },
        remove(name: string, options?: any) {
          cookieStore.set({ name, value: '', ...(options || {}) });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return (
      <main className="container">
        <h1>Criar/Selecionar Personagem</h1>
        <p className="muted">Faça login para ver seus personagens.</p>
      </main>
    );
  }

  const { data: chars, error } = await supabase
    .from('characters')
    .select('id,name,surname,universe,energy,level,xp,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <main className="container">
        <h1>Criar/Selecionar Personagem</h1>
        <p className="muted">Erro: {error.message}</p>
      </main>
    );
  }

  return (
    <main className="container">
      <h1>Criar/Selecionar Personagem</h1>

      <div className="card" style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <Link className="btn" href="/characters/new">Criar</Link>
        <Link className="btn" href="/characters">Voltar</Link>
      </div>

      {!chars?.length ? (
        <p className="muted">Você ainda não tem personagens.</p>
      ) : (
        <div className="grid-cards">
          {chars.map((c) => (
            <div key={c.id} className="card">
              <div className="card-title">{c.name} {c.surname}</div>
              <div className="muted">{c.universe} · {c.energy} · Lv {c.level} · XP {c.xp}</div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
