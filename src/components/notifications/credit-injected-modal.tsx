'use client'

import { useState } from 'react'
import { AppDialog } from '@/components/ui/app-dialog'
import { Button } from '@/components/ui/button'
import { useApp } from '@/context/app-context'
import { acknowledgeNotification } from '@/server/actions/notifications'

interface CreditInjectedModalProps {
  notificationId: string
  title: string
  body: string | null
}

export function CreditInjectedModal({ notificationId, title, body }: CreditInjectedModalProps) {
  const [open, setOpen] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const { refreshCredits } = useApp()

  async function handleAcknowledge() {
    setSubmitting(true)
    const result = await acknowledgeNotification(notificationId)
    if (!result.error) {
      await refreshCredits()
    }
    setSubmitting(false)
    setOpen(false)
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={(o) => { if (!o) handleAcknowledge() }}
      title={title}
      description={body ?? undefined}
      logoId="credit-injected"
      footer={
        <Button
          onClick={handleAcknowledge}
          disabled={submitting}
          style={{ background: 'var(--gradient-brand)', color: 'white' }}
        >
          {submitting ? 'Aguarde...' : 'Entendi'}
        </Button>
      }
    >
      <p className="text-sm text-muted-foreground text-center">
        Os creditos ja estao disponiveis na sua carteira bonus.
      </p>
    </AppDialog>
  )
}
