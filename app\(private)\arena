'use client'
import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import FightButton from '@/components/arena/FightButton'
import ResultBox from '@/components/arena/ResultBox'

export default function ArenaPage() {
  const [result, setResult] = useState<string | null>(null)
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Card>
        <h1 className="text-xl font-bold mb-2">Arena PvE</h1>
        <p className="text-sm opacity-80 mb-4">Enfrente inimigos e ganhe experiência.</p>
        <FightButton onDone={setResult} />
        <ResultBox text={result} />
      </Card>
    </div>
  )
}
