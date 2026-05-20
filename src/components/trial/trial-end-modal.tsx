'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Star } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Logo } from '@/components/ui/logo'
import { Separator } from '@/components/ui/separator'
import { saveFeedback, scheduleAccountDeletion, markFeedbackUpgrade } from '@/server/actions/feedback'
import { ROUTES } from '@/lib/routes'
import { hardNavigate } from '@/lib/navigation'

type Step = 'feedback' | 'decision' | 'confirm-delete'

interface TrialEndModalProps {
  open: boolean
}

export function TrialEndModal({ open }: TrialEndModalProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('feedback')
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [message, setMessage] = useState('')
  const [feedbackId, setFeedbackId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleAdvance() {
    setLoading(true)
    const promise = saveFeedback({ rating, message })
    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Avaliação registrada.',
      error: 'Erro ao salvar avaliação.',
    })
    const result = await promise.catch(() => null)
    setLoading(false)
    if (result?.feedbackId) {
      setFeedbackId(result.feedbackId)
      setStep('decision')
    }
  }

  async function handleUpgrade() {
    setLoading(true)
    if (feedbackId) {
      const promise = markFeedbackUpgrade(feedbackId, 'upgrade_modal')
      toast.promise(promise, {
        loading: 'Aguarde...',
        success: 'Redirecionando...',
        error: 'Erro ao registrar.',
      })
      await promise.catch(() => null)
    }
    setLoading(false)
    router.push(ROUTES.planos)
  }

  async function handleConfirmDelete() {
    if (!feedbackId) return
    setLoading(true)
    const promise = scheduleAccountDeletion(feedbackId)
    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Conta encerrada. Seus dados serão excluídos em 7 dias.',
      error: 'Erro ao encerrar conta.',
    })
    await promise.catch(() => null)
    setLoading(false)
    hardNavigate(ROUTES.dashboard)
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        onEscapeKeyDown={e => e.preventDefault()}
        onPointerDownOutside={e => e.preventDefault()}
        onInteractOutside={e => e.preventDefault()}
      >
        <DialogHeader className="items-center">
          <Logo size="sm" id="trial-end" />
        </DialogHeader>
        <Separator />

        {step === 'feedback' && (
          <div className="flex flex-col items-center gap-5 py-2">
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-3xl">⭐</span>
              <DialogTitle className="text-lg font-bold">
                Seu período de teste chegou ao fim!
              </DialogTitle>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">
                Conte-nos como foi sua experiência com a IA
              </p>
            </div>

            <div className="flex flex-col items-center gap-2 w-full">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Avaliação do Anamnese IA
              </p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    aria-label={`estrela ${n}`}
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setHovered(n)}
                    onMouseLeave={() => setHovered(0)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      className="w-7 h-7"
                      fill={(hovered || rating) >= n ? '#F59E0B' : 'transparent'}
                      stroke={(hovered || rating) >= n ? '#F59E0B' : 'currentColor'}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-2">
                Sugestões de melhoria (opcional)
              </p>
              <Textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Como podemos tornar o Anamnese IA ainda melhor para você?"
                rows={3}
                className="resize-none"
              />
            </div>

            <Button
              className="w-full"
              onClick={handleAdvance}
              disabled={rating === 0 || loading}
              style={{ background: 'var(--gradient-brand)', color: 'white' }}
            >
              Avançar →
            </Button>
          </div>
        )}

        {step === 'decision' && (
          <div className="flex flex-col items-center gap-5 py-2">
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-3xl">🚀</span>
              <DialogTitle className="text-lg font-bold">
                O que deseja fazer agora?
              </DialogTitle>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">
                Oferta de lançamento
              </p>
            </div>
            <Button
              className="w-full"
              onClick={handleUpgrade}
              disabled={loading}
              style={{ background: 'var(--gradient-brand)', color: 'white' }}
            >
              Ver planos disponíveis
            </Button>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => setStep('confirm-delete')}
            >
              Encerrar período de teste
            </Button>
          </div>
        )}

        {step === 'confirm-delete' && (
          <div className="flex flex-col items-center gap-5 py-2">
            <div className="flex flex-col items-center gap-1 text-center">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <span className="text-destructive text-xl">⚠</span>
              </div>
              <DialogTitle className="text-lg font-bold text-destructive">
                Exclusão Crítica
              </DialogTitle>
              <p className="text-sm text-muted-foreground">Direito ao Esquecimento</p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 text-center space-y-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Em conformidade com a{' '}
                <span className="font-bold text-foreground">LGPD</span>, informamos que:
              </p>
              <p className="text-sm font-medium">
                &quot;Todos os prontuários, registros e dados de pacientes gerados durante
                seu teste serão permanentemente apagados dos nossos servidores.&quot;
              </p>
            </div>

            <div className="border border-destructive/30 rounded-md px-4 py-2">
              <p className="text-xs text-destructive font-medium uppercase tracking-widest">
                Você tem 7 dias para cancelar esta ação
              </p>
            </div>

            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep('decision')}
              >
                Voltar
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleConfirmDelete}
                disabled={!feedbackId || loading}
              >
                Confirmar encerramento
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
