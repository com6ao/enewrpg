'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { simulateCombat } from '@/lib/combat'

export default function ArenaPage() {
  const [result, setResult] = useState<string | null>(null)

  async function handleFight() {
    const res = await fetch('/api/arena/router', { method: 'POST' })
    const data = await res.json()
    setResult(data.message)
  }

  return (
    <div className="p-6 grid gap-4">
      <Card className="max-w-xl">
        <CardContent className="p-4 space-y-4">
          <h1 className="text-xl font-bold">Arena PvE</h1>
          <p>Enfrente inimigos controlados pelo sistema e ganhe experiência.</p>
          <Button onClick={handleFight}>Lutar</Button>
          {result && <div className="mt-4 p-2 border rounded">{result}</div>}
        </CardContent>
      </Card>
    </div>
  )
}
