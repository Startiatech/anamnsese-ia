'use client'

import { useState } from 'react'
import { useConsoleNotification } from '@/context/console-notification-context'
import { ClipboardX, MessageSquare, MoreHorizontal, CheckCircle, XCircle } from 'lucide-react'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import type { AccessRequest } from '@/lib/types'
import { PageHeader } from '@/components/console/page-header'
import { StatusBadge } from '@/components/console/status-badge'
import { toast } from 'sonner'
import { API } from '@/lib/routes'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'

type Filter = 'all' | 'pending' | 'approved' | 'rejected'


function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function RequestsClient(_: { initialRequests: AccessRequest[] }) {
  const { requests, setRequests } = useConsoleNotification()
  const [filter, setFilter] = useState<Filter>('all')
  const [processingId, setProcessingId] = useState<string | null>(null)

  async function handleReject(request: AccessRequest) {
    setProcessingId(request.id)

    const lines = [
      '❌ *Anamnese IA — Solicitação não aprovada*', '',
      `Olá, ${request.name.split(' ')[0]}. Infelizmente sua solicitação de acesso à plataforma não foi aprovada neste momento.`, '',
      'Se acredita que houve um engano ou tem dúvidas, entre em contato conosco respondendo esta mensagem.',
      '', '_Equipe Anamnese IA_',
    ].join('\n')
    const phone = request.phone.replace(/\D/g, '')
    const waWindow = window.open(`https://wa.me/${phone.startsWith('55') ? phone : `55${phone}`}?text=${encodeURIComponent(lines)}`, '_blank')

    const promise = fetch(API.requestId(request.id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected' }),
    }).then((res) => {
      if (!res.ok) { waWindow?.close(); throw new Error('Erro ao rejeitar') }
      setRequests((prev) => prev.map((r) => r.id === request.id ? { ...r, status: 'rejected' as const } : r))
    })
    toast.promise(promise, { loading: 'Aguarde...', success: 'Solicitação rejeitada.', error: 'Erro ao rejeitar.' })
    await promise.catch(() => {})
    setProcessingId(null)
  }

  async function handleApprove(request: AccessRequest) {
    setProcessingId(request.id)
    const tempPassword = Math.random().toString(36).slice(2, 10)

    // Monta a URL do WhatsApp antes do fetch — window.open só funciona no contexto do clique
    const lines = [
      '✅ *Anamnese IA — Bem-vindo(a)!*', '',
      `Olá, ${request.name.split(' ')[0]}! É com satisfação que informamos que seu acesso à plataforma Anamnese IA foi aprovado.`, '',
      'Abaixo estão suas credenciais de acesso:',
      `📧 *E-mail:* ${request.email}`,
      `🔒 *Senha provisória:* ${tempPassword}`, '',
      '*Para acessar a plataforma, siga os passos abaixo:*',
      `1️⃣ Acesse a página principal pelo link: 🔗 ${process.env.NEXT_PUBLIC_APP_URL}`,
      '2️⃣ Clique no botão *Entrar* no canto superior direito da página',
      '3️⃣ Insira seu e-mail e senha provisória para realizar o login', '',
      'Por segurança, recomendamos que você altere sua senha no primeiro acesso.', '',
      'Qualquer dúvida, estamos à disposição. Bom trabalho! 🩺',
    ]
    const phone = request.phone.replace(/\D/g, '')
    const waUrl = `https://wa.me/${phone.startsWith('55') ? phone : `55${phone}`}?text=${encodeURIComponent(lines.join('\n'))}`
    const waWindow = window.open(waUrl, '_blank')

    const promise = fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: request.name, email: request.email, specialty: request.specialty, phone: request.phone, password: tempPassword }),
    }).then(async (res) => {
      if (!res.ok) {
        waWindow?.close()
        throw new Error('Erro ao criar usuário')
      }
      await fetch(API.requestId(request.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      })
      setRequests((prev) => prev.map((r) => r.id === request.id ? { ...r, status: 'approved' as const } : r))
    })
    toast.promise(promise, { loading: 'Aguarde...', success: 'Acesso liberado!', error: 'Erro ao aprovar.' })
    await promise.catch(() => {})
    setProcessingId(null)
  }

  const counts = {
    all:      requests.length,
    pending:  requests.filter((r) => r.status === 'pending').length,
    approved: requests.filter((r) => r.status === 'approved').length,
    rejected: requests.filter((r) => r.status === 'rejected').length,
  }

  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter)
  const sorted = [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all',      label: `Todas (${counts.all})` },
    { key: 'pending',  label: `Pendentes (${counts.pending})` },
    { key: 'approved', label: `Aprovadas (${counts.approved})` },
    { key: 'rejected', label: `Rejeitadas (${counts.rejected})` },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Solicitações de acesso" description="Gerencie os pedidos de acesso à plataforma" />

      <div>
        <h2 className="text-base font-semibold text-foreground mb-3">Situação</h2>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={[
                'px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap',
                filter === key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-transparent border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><ClipboardX /></EmptyMedia>
            <EmptyTitle className="text-sm font-medium">Nenhuma solicitação encontrada</EmptyTitle>
            <EmptyDescription className="text-xs">
              {filter === 'all'
                ? 'As solicitações de acesso aparecerão aqui.'
                : 'Não há solicitações com esta situação no momento.'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <TooltipProvider delayDuration={200}>
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Especialidade</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((r) => {
                  const processing = processingId === r.id
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <p className="text-sm font-medium text-foreground">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{r.email}</p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.specialty}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.phone}</TableCell>
                      <TableCell>
                        {r.message ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                                <MessageSquare className="h-3.5 w-3.5" />
                                Ver
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-xs italic">
                              &ldquo;{r.message}&rdquo;
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                      <TableCell><StatusBadge variant="request" status={r.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(r.createdAt)}</TableCell>
                      <TableCell>
                        {r.status === 'pending' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" disabled={processing} className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleApprove(r)}
                                disabled={processing}
                                className="gap-2 text-emerald-600 dark:text-emerald-400 focus:text-emerald-600 dark:focus:text-emerald-400"
                              >
                                <CheckCircle className="h-4 w-4" />
                                {processing ? 'Aguarde...' : 'Aprovar'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleReject(r)}
                                disabled={processing}
                                className="gap-2 text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                              >
                                <XCircle className="h-4 w-4" />
                                {processing ? 'Aguarde...' : 'Rejeitar'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </TooltipProvider>
      )}
    </div>
  )
}
