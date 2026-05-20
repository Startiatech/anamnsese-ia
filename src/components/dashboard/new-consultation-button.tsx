'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useApp } from '@/context/app-context'
import { NoCreditsModal } from './no-credits-modal'
import { API, ROUTES } from '@/lib/routes'
import { Button } from '@/components/ui/button'

interface NewConsultationButtonProps {
  hasCredits: boolean
}

export function NewConsultationButton({ hasCredits }: NewConsultationButtonProps) {
  const router = useRouter()
  const { credits, refreshCredits } = useApp()
  const [processing, setProcessing] = useState(false)
  const [showNoCredits, setShowNoCredits] = useState(false)

  const canStart = credits > 0 || hasCredits

  async function handleClick() {
    if (!canStart) {
      setShowNoCredits(true)
      return
    }

    setProcessing(true)

    const promise = fetch(API.meDebit, { method: 'POST' }).then(async (res) => {
      if (!res.ok) throw new Error('Erro ao processar crédito')
    })

    toast.promise(promise, {
      loading: 'Aguarde...',
      success: () => {
        const remaining = Math.max(0, credits - 1)
        return `1 crédito utilizado (restam ${remaining})`
      },
      error: 'Erro ao processar crédito. Tente novamente.',
    })

    await promise.catch(() => { setProcessing(false) })

    sessionStorage.setItem('consultation_debit_pending', '1')
    await refreshCredits()
    setProcessing(false)
    router.push(ROUTES.atendimentoNovo)
  }

  return (
    <>
      <Button onClick={handleClick} disabled={processing}>
        {processing ? 'Aguarde...' : '+ Novo atendimento'}
      </Button>

      <NoCreditsModal
        open={showNoCredits}
        onClose={() => setShowNoCredits(false)}
      />
    </>
  )
}
