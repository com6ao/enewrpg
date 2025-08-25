'use client'
import { useState } from 'react'
import Button from '@/components/ui/Button'
import { postFight } from '@/services/arena'

export default function FightButton({ onDone }: { onDone: (m: string) => void }) {
  const [loading, setLoading] = useState(false)
  return (
    <Button
      onClick={async () => {
        setLoading(true)
        try {
          const { message } = await postFight()
          onDone(message)
        } catch (e: any) {
          onDone(e?.message || 'Erro na luta')
        } finally {
          setLoading(false)
        }
      }}
      disabled={loading}
    >
      {loading ? 'Simulando...' : 'Lutar'}
    </Button>
  )
}
