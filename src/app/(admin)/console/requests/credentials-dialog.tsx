'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Copy, MessageCircle, Check } from 'lucide-react'
import { AppDialog } from '@/components/ui/app-dialog'
import { Button } from '@/components/ui/button'

interface CredentialsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  email: string
  phone: string
  password: string
}

/**
 * Modal exibido apos aprovar ou reenviar credenciais. Mostra a senha
 * temporaria com botoes para copiar e abrir WhatsApp. Senha so visivel
 * enquanto o modal estiver aberto.
 */
export function CredentialsDialog({
  open,
  onOpenChange,
  name,
  email,
  phone,
  password,
}: CredentialsDialogProps) {
  const [copied, setCopied] = useState(false)

  const message = [
    '✅ *Anamnese IA — Bem-vindo(a)!*',
    '',
    `Olá, ${name.split(' ')[0]}! É com satisfação que informamos que seu acesso à plataforma Anamnese IA foi aprovado.`,
    '',
    'Abaixo estão suas credenciais de acesso:',
    `📧 *E-mail:* ${email}`,
    `🔒 *Senha provisória:* ${password}`,
    '',
    '*Para acessar a plataforma, siga os passos abaixo:*',
    `1️⃣ Acesse a página principal pelo link: 🔗 ${process.env.NEXT_PUBLIC_SITE_URL ?? ''}`,
    '2️⃣ Clique no botão *Entrar* no canto superior direito da página',
    '3️⃣ Insira seu e-mail e senha provisória para realizar o login',
    '',
    'Por segurança, recomendamos que você altere sua senha no primeiro acesso.',
    '',
    'Qualquer dúvida, estamos à disposição. Bom trabalho! 🩺',
  ].join('\n')

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      toast.success('Senha copiada.')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Erro ao copiar — copie manualmente.')
    }
  }

  function handleOpenWhatsApp() {
    const phoneDigits = phone.replace(/\D/g, '')
    const fullPhone = phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`
    window.open(
      `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`,
      '_blank',
    )
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Credenciais geradas"
      description="Copie a senha agora — ela so sera mostrada uma vez. Voce pode reenviar pela lista de solicitacoes aprovadas se precisar."
      logoId="credentials-dialog"
      cancelLabel="Fechar"
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
            Email
          </div>
          <div className="text-sm">{email}</div>
        </div>

        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
            Senha provisoria
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate text-base font-mono bg-muted px-3 py-2 rounded-md select-all">
              {password}
            </code>
            <Button
              type="button"
              variant="outline"
              onClick={handleCopy}
              aria-label="Copiar senha"
              className="h-11 shrink-0 gap-1.5 px-3"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
        </div>

        <Button
          type="button"
          onClick={handleOpenWhatsApp}
          className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <MessageCircle className="h-4 w-4" />
          Abrir WhatsApp com credenciais
        </Button>
      </div>
    </AppDialog>
  )
}
