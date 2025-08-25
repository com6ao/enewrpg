export async function postFight(): Promise<{ message: string }> {
  const res = await fetch('/api/arena/router', { method: 'POST' })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error || 'Falha na luta')
  return json
}
