'use client'

import { useState } from 'react'
import { useConsoleNotification } from '@/context/console-notification-context'
import { RequestCard } from './request-card'
import { ClipboardX, MessageSquare, MoreHorizontal, CheckCircle, XCircle, KeyRound } from 'lucide-react'
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
import { AppDialog } from '@/components/ui/app-dialog'
import { CredentialsDialog } from './credentials-dialog'

interface Credentials {
  name: string
  email: string
  phone: string
  password: string
}

type Filter = 'all' | 'pending' | 'approved' | 'rejected'


function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// Senha provisória com CSPRNG (não Math.random): 16 hex chars (~64 bits).
function generateTempPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function RequestsClient(_: { initialRequests: AccessRequest[] }) {
  const { requests, setRequests } = useConsoleNotification()
  const [filter, setFilter] = useState<Filter>('all')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [viewMessage, setViewMessage] = useState<AccessRequest | null>(null)

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
    const tempPassword = generateTempPassword()

    const promise = fetch(API.createUser, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: request.name, email: request.email, specialty: request.specialty, phone: request.phone, password: tempPassword }),
    }).then(async (res) => {
      if (!res.ok) throw new Error('Erro ao criar usuário')
      // Usuario criado: exibe as credenciais imediatamente — a senha so e mostrada
      // uma vez e o master precisa envia-la, independente do resultado do PATCH.
      setCredentials({
        name: request.name,
        email: request.email,
        phone: request.phone,
        password: tempPassword,
      })
      const statusRes = await fetch(API.requestId(request.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      })
      if (!statusRes.ok) {
        // Usuario foi criado, mas a solicitacao nao foi marcada como aprovada.
        // Nao marca aprovada localmente (fica visivel para reprocessar) e avisa.
        throw new Error('Usuário criado, mas falha ao marcar a solicitação como aprovada — atualize a página.')
      }
      setRequests((prev) => prev.map((r) => r.id === request.id ? { ...r, status: 'approved' as const } : r))
    })
    toast.promise(promise, { loading: 'Aguarde...', success: 'Acesso liberado!', error: (e: Error) => e.message })
    await promise.catch(() => {})
    setProcessingId(null)
  }

  async function handleViewCredentials(request: AccessRequest) {
    setProcessingId(request.id)
    const promise = fetch(API.adminRequestViewCredentials(request.id)).then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Erro ao buscar credenciais' }))
        throw new Error(body.error ?? 'Erro ao buscar credenciais')
      }
      const data = (await res.json()) as Credentials & { ok: boolean }
      setCredentials({
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: data.password,
      })
    })
    toast.promise(promise, {
      loading: 'Consultando credenciais...',
      success: 'Credenciais carregadas!',
      error: (e: Error) => e.message,
    })
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
        <>
          <div className="hidden md:block rounded-xl border border-border overflow-hidden">
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
                          // Clique/toque abre a mensagem em dialog — funciona no
                          // touch (tablet), onde nao ha hover para tooltip.
                          <button
                            onClick={() => setViewMessage(r)}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            Ver
                          </button>
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
                        {r.status === 'approved' && r.userPasswordIsTemp && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={processing}
                            onClick={() => handleViewCredentials(r)}
                            className="gap-1.5 h-8"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            {processing ? 'Aguarde...' : 'Ver credenciais'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden space-y-3">
            {sorted.map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                processing={processingId === r.id}
                onApprove={handleApprove}
                onReject={handleReject}
                onViewCredentials={handleViewCredentials}
              />
            ))}
          </div>
        </>
      )}

      {viewMessage && (
        <AppDialog
          open
          onOpenChange={(o) => { if (!o) setViewMessage(null) }}
          title={`Mensagem — ${viewMessage.name}`}
          description={`Solicitação de ${viewMessage.email}`}
          logoId="request-message-modal"
          maxWidth="max-w-md"
        >
          <p className="text-sm italic text-foreground whitespace-pre-wrap break-words">
            &ldquo;{viewMessage.message}&rdquo;
          </p>
        </AppDialog>
      )}

      {credentials && (
        <CredentialsDialog
          open
          onOpenChange={(open) => !open && setCredentials(null)}
          name={credentials.name}
          email={credentials.email}
          phone={credentials.phone}
          password={credentials.password}
        />
      )}
    </div>
  )
}
