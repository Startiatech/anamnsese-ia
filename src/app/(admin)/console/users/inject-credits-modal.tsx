'use client'

import { useState } from 'react'
import { Coins } from 'lucide-react'
import { injectCredits } from '@/server/actions/credits'
import { toast } from 'sonner'
import { AppDialog } from '@/components/ui/app-dialog'
import type { UserRow } from './users-client'

interface InjectCreditsModalProps {
  user: UserRow | null
  open: boolean
  onClose: () => void
  onSuccess: (userId: string, newTotal: number) => void
}

export function InjectCreditsModal({ user, open, onClose, onSuccess }: InjectCreditsModalProps) {
  const [amount, setAmount] = useState(10)
  const [loading, setLoading] = useState(false)

  if (!user) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const promise = injectCredits(user!.id, amount).then((r) => {
      if (!r.ok) throw new Error(r.error)
      onSuccess(user!.id, r.newTotal!)
      onClose()
      return r
    })
    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Créditos injetados!',
      error: (e: Error) => e.message,
    })
    await promise.catch(() => {})
    setLoading(false)
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Injetar créditos"
      description={
        <span className="text-sm text-muted-foreground">
          Usuário: <span className="text-foreground font-medium">{user.name}</span>
          {' · '}Créditos atuais: <span className="text-foreground font-medium">{user.credits}</span>
        </span>
      }
      logoId="inject-credits-modal"
      formId="inject-credits-form"
      submitLabel={`Adicionar ${amount} crédito${amount !== 1 ? 's' : ''}`}
      submitDisabled={loading}
      maxWidth="max-w-sm"
    >
      <form id="inject-credits-form" onSubmit={handleSubmit} className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Coins className="h-3.5 w-3.5" /> Quantidade a adicionar
        </label>
        <input
          type="number"
          min={1}
          max={500}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-full bg-transparent border-b border-border pb-1.5 text-sm text-foreground focus:outline-none focus:border-highlight transition-colors"
        />
      </form>
    </AppDialog>
  )
}
