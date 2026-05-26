'use client'

import { useEffect, useState } from 'react'
import { MessageSquarePlus, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { submitAccessibilityRequest } from '@/server/actions/accessibility-requests'

const MIN_CHARS = 10
const MAX_CHARS = 500
const SUCCESS_DURATION_MS = 5000

export function RequestFeedbackCard() {
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [justSent, setJustSent] = useState(false)

  useEffect(() => {
    if (!justSent) return
    const t = setTimeout(() => setJustSent(false), SUCCESS_DURATION_MS)
    return () => clearTimeout(t)
  }, [justSent])

  const trimmedLength = message.trim().length
  const canSubmit = trimmedLength >= MIN_CHARS && trimmedLength <= MAX_CHARS && !submitting

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    const promise = submitAccessibilityRequest({ message: message.trim() }).then((res) => {
      if (!res.ok) throw new Error(res.error ?? 'Erro ao enviar pedido')
      return res
    })

    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Pedido enviado, obrigado!',
      error: (e: Error) => e.message,
    })

    try {
      await promise
      setMessage('')
      setJustSent(true)
    } catch {
      // toast ja exibiu o erro — texto e mantido no campo para reenvio
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex gap-4 mb-5">
          <div className="shrink-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-violet-500/15 dark:bg-violet-500/10 border border-violet-500/25 dark:border-violet-500/20">
              <MessageSquarePlus className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
          </div>
          <div className="flex-1 space-y-1 pt-1">
            <p className="text-sm font-semibold text-foreground uppercase tracking-wide">Falta algum ajuste?</p>
            <p className="text-xs text-muted-foreground">
              Conte o que ajudaria sua experiência. Lemos todos os pedidos para definir o que construir em seguida.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="a11y-request-message" className="sr-only">Seu pedido de acessibilidade</label>
          <textarea
            id="a11y-request-message"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_CHARS))}
            placeholder="Ex.: gostaria de uma fonte específica para dislexia, ou de uma opção para reduzir a saturação das cores..."
            rows={4}
            aria-label="Seu pedido"
            disabled={submitting}
            className="w-full bg-transparent border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background resize-y disabled:opacity-60"
          />

          <div className="flex items-center justify-between gap-3">
            <span
              className={`text-xs ${
                trimmedLength > MAX_CHARS
                  ? 'text-destructive'
                  : trimmedLength >= MIN_CHARS
                    ? 'text-muted-foreground'
                    : 'text-muted-foreground/60'
              }`}
            >
              {trimmedLength} / {MAX_CHARS}
              {trimmedLength > 0 && trimmedLength < MIN_CHARS && (
                <span className="ml-2">(mínimo {MIN_CHARS} caracteres)</span>
              )}
            </span>

            <div className="flex items-center gap-3">
              {justSent && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-500 dark:text-emerald-400" role="status">
                  <Check className="h-3 w-3" />
                  Pedido enviado, obrigado!
                </span>
              )}
              <Button
                type="button"
                size="sm"
                disabled={!canSubmit}
                onClick={handleSubmit}
              >
                {submitting ? 'Aguarde...' : 'Enviar'}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
