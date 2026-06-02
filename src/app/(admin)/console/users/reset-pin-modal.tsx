'use client'

import { useState } from 'react'
import { Copy, Check, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { AppDialog } from '@/components/ui/app-dialog'
import { API } from '@/lib/routes'
import type { UserRow } from './users-client'

interface ResetPinModalProps {
  user: UserRow | null
  open: boolean
  onClose: () => void
  onSuccess: (userId: string) => void
}

export function ResetPinModal({ user, open, onClose, onSuccess }: ResetPinModalProps) {
  const [loading, setLoading] = useState(false)
  const [pin, setPin]         = useState<string | null>(null)
  const [copied, setCopied]   = useState(false)

  function handleClose() {
    setPin(null)
    setCopied(false)
    onClose()
  }

  async function handleReset() {
    if (!user) return
    setLoading(true)
    const promise = fetch(API.adminResetPin(user.id), { method: 'POST' })
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body.error ?? 'Erro ao redefinir PIN')
        setPin(body.pin)
        onSuccess(user.id)
      })
    toast.promise(promise, {
      loading: 'Aguarde...',
      error: (e: Error) => e.message,
    })
    await promise.catch(() => {})
    setLoading(false)
  }

  async function handleCopy() {
    if (!pin) return
    await navigator.clipboard.writeText(pin)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function buildWhatsAppLink() {
    if (!user?.phone || !pin) return null
    const num = user.phone.replace(/\D/g, '')
    const now = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })
    const msg = [
      '🔐 Anamnese IA — PIN temporário',
      `Olá, ${user.name}! Seu PIN de recuperação foi redefinido pelo suporte.`,
      '',
      `PIN temporário: ${pin}`,
      `Gerado em ${now}`,
      '',
      'Ao acessar a plataforma com este PIN, você será obrigado a definir uma nova senha e um novo PIN.',
    ].join('\n')
    return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
  }

  if (!user) return null

  const whatsappLink = buildWhatsAppLink()

  const footer = !pin ? (
    <>
      <Button variant="outline" onClick={handleClose} disabled={loading}>Cancelar</Button>
      <Button onClick={handleReset} disabled={loading}>
        {loading ? 'Aguarde...' : 'Gerar PIN temporário'}
      </Button>
    </>
  ) : (
    <>
      {whatsappLink ? (
        <a href={whatsappLink} target="_blank" rel="noopener noreferrer" onClick={handleClose}>
          <Button className="gap-2" style={{ background: '#25D366' }}>
            <MessageCircle className="h-4 w-4" />
            Enviar pelo WhatsApp
          </Button>
        </a>
      ) : (
        <p className="flex-1 text-xs text-muted-foreground self-center">
          Usuário sem telefone cadastrado — envie o PIN manualmente.
        </p>
      )}
      <Button variant="outline" onClick={handleClose}>Fechar</Button>
    </>
  )

  return (
    <AppDialog
      open={open}
      onOpenChange={(o) => !o && handleClose()}
      title="Redefinir PIN"
      description={
        pin
          ? 'PIN temporário gerado. Copie e envie ao usuário via WhatsApp.'
          : `Gera um PIN temporário de 6 dígitos para ${user.name}. O usuário será obrigado a definir uma nova senha e PIN ao acessar.`
      }
      logoId="reset-pin-modal"
      footer={footer}
      maxWidth="max-w-sm"
    >
      {pin ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl px-4 py-3 bg-blue-500/10 border border-blue-500/25">
            <span className="text-2xl font-mono font-bold tracking-[0.4em] text-blue-700 dark:text-blue-300">{pin}</span>
            <Button variant="ghost" size="icon" onClick={handleCopy} className="shrink-0">
              {copied ? <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Este PIN é exibido uma única vez e não poderá ser recuperado depois.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Ao confirmar, o PIN anterior de <span className="text-foreground font-medium">{user.name}</span> será invalidado imediatamente.
        </p>
      )}
    </AppDialog>
  )
}
