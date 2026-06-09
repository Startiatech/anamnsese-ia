'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ROUTES } from '@/lib/routes'
import { generateTempPassword } from '@/lib/temp-password'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { IconBadge } from '@/components/ui/icon-badge'
import { Users, ClipboardList, CheckCircle, Clock, ArrowRight, UserRoundX, ActivityIcon, Stethoscope, RefreshCw, Bell } from 'lucide-react'
import { toast } from 'sonner'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import Link from 'next/link'
import type { AccessRequest, NewUser } from '@/lib/types'
import { PageHeader } from '@/components/console/page-header'
import { StatusBadge } from '@/components/console/status-badge'
import type { CostSummary } from '@/server/repositories/usage'
import { useConsoleNotification } from '@/context/console-notification-context'
import { Button } from '@/components/ui/button'
import { formatBRL } from '@/lib/currency'


const DEFAULT_COST_SUMMARY: CostSummary = { day: 0, week: 0, month: 0, total: 0 }

export type ProfessionalRow = {
  id: string
  name: string
  email: string
  specialty: string
  status: 'onboarding' | 'active' | 'blocked'
}

export function ConsoleDashboardClient({
  groqCostSummary = DEFAULT_COST_SUMMARY,
  professionalsCount = 0,
  activeUsersCount = 0,
  usdToBrl = 5.75,
  professionals = [],
  interestCount = 0,
  interestByPlan = { profissional: 0, 'gestao-clinicas': 0 },
}: {
  initialRequests: AccessRequest[]
  groqCostSummary?: CostSummary
  professionalsCount?: number
  activeUsersCount?: number
  usdToBrl?: number
  professionals?: ProfessionalRow[]
  interestCount?: number
  interestByPlan?: { profissional: number; 'gestao-clinicas': number }
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { requests, setRequests } = useConsoleNotification()
  const [approvedUser, setApprovedUser] = useState<NewUser | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const pending = requests.filter((r) => r.status === 'pending')
  const recent = [...requests]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  async function handleApprove(request: AccessRequest) {
    setProcessingId(request.id)
    const tempPassword = generateTempPassword()
    const promise = fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: request.name, email: request.email, specialty: request.specialty, phone: request.phone, password: tempPassword }),
    }).then(async (res) => {
      if (!res.ok) throw new Error('Erro ao criar usuário')
      await fetch(`/api/requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      })
      setRequests((prev) => prev.map((r) => r.id === request.id ? { ...r, status: 'approved' as const } : r))
      setApprovedUser({ email: request.email, tempPassword })
      const lines = [
        '✅ *Anamnese IA — Acesso liberado!*', '',
        `Olá, ${request.name.split(' ')[0]}! Seu acesso à plataforma foi aprovado.`,
        `*Email:* ${request.email}`,
        `*Senha provisória:* ${tempPassword}`, '',
        '*Para acessar a plataforma, siga os passos abaixo:*',
        `1️⃣ Acesse a página principal pelo link: 🔗 ${process.env.NEXT_PUBLIC_SITE_URL}`,
        '2️⃣ Clique no botão *Entrar* no canto superior direito da página',
        '3️⃣ Insira seu e-mail e senha provisória para realizar o login', '',
        'Por segurança, recomendamos que você altere sua senha no primeiro acesso.', '',
        'Qualquer dúvida, estamos à disposição. Bom trabalho! 🩺',
      ].join('\n')
      const phone = request.phone.replace(/\D/g, '')
      window.open(`https://wa.me/${phone.startsWith('55') ? phone : `55${phone}`}?text=${encodeURIComponent(lines)}`, '_blank')
    })
    toast.promise(promise, { loading: 'Aguarde...', success: 'Acesso liberado!', error: 'Erro ao aprovar.' })
    await promise.catch(() => {})
    setProcessingId(null)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Visão geral da plataforma"
        action={
          <Button variant="ghost" size="sm" onClick={() => startTransition(() => router.refresh())} disabled={isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isPending ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        }
      />

      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-base font-semibold text-foreground">Recursos & Custos</h2>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-muted-foreground">Groq (AI)</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-normal flex items-center justify-between">
                Consumo por período
                <span className="text-xs font-mono text-muted-foreground/60">1 USD = {formatBRL(1, usdToBrl)}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 divide-x divide-border">
                {([
                  { label: 'Hoje', value: groqCostSummary.day },
                  { label: '7 dias', value: groqCostSummary.week },
                  { label: '30 dias', value: groqCostSummary.month },
                ] as const).map(({ label, value }) => (
                  <div key={label} className="flex flex-col items-center py-2 px-3 gap-0.5">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className="text-lg font-semibold text-primary">${value.toFixed(4)}</span>
                    <span className="text-xs text-muted-foreground">{formatBRL(value, usdToBrl)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Total acumulado</span>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">${groqCostSummary.total.toFixed(4)}</p>
                  <p className="text-xs text-muted-foreground">{formatBRL(groqCostSummary.total, usdToBrl)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-normal">Profissionais cadastrados</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-4 pt-2">
              <IconBadge icon={Stethoscope} size="lg" />
              <div>
                <p className="text-3xl font-bold text-foreground">{professionalsCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">ativos, sem exclusão agendada</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-base font-semibold text-foreground">Métricas</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Pendentes',         value: pending.length,       icon: Clock },
            { label: 'Aprovados',          value: professionals.length, icon: CheckCircle },
            { label: 'Total solicitações', value: requests.length,      icon: ClipboardList },
            { label: 'Usuários ativos',    value: activeUsersCount,     icon: Users },
            { label: 'Interesses planos',  value: interestCount,        icon: Bell },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{label}</p>
                    <p className="text-2xl font-bold text-foreground">{value}</p>
                  </div>
                  <IconBadge icon={Icon} size="sm" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {interestCount > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                Interesse por plano
              </CardTitle>
              <Link href={ROUTES.consoleInteresses} className="text-xs text-highlight hover:text-highlight/70 flex items-center gap-1 transition-colors">
                Ver todos <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 divide-x divide-border">
              {([
                { label: 'Profissional',      value: interestByPlan.profissional },
                { label: 'Gestão & Clínicas', value: interestByPlan['gestao-clinicas'] },
              ] as const).map(({ label, value }) => (
                <div key={label} className="flex flex-col items-center py-2 px-3 gap-0.5">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="text-2xl font-bold text-primary">{value}</span>
                  <span className="text-xs text-muted-foreground">{interestCount > 0 ? Math.round((value / interestCount) * 100) : 0}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {pending.length > 0 && (
        <Card className="border-amber-500/25 bg-amber-500/[0.04]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                Aguardando aprovação
                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25">{pending.length}</Badge>
              </CardTitle>
              <Link href={ROUTES.consoleSolicitacoes} className="text-xs text-highlight hover:text-highlight/70 flex items-center gap-1 transition-colors">
                Ver todas <ArrowRight className="h-3 w-3" />
              </Link>

            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {pending.slice(0, 3).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border bg-card">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.specialty} · {new Date(r.createdAt).toLocaleDateString('pt-BR')}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleApprove(r)}
                  disabled={processingId === r.id}
                  className="shrink-0"
                >
                  {processingId === r.id ? 'Aguarde...' : 'Aprovar'}
                </Button>
              </div>
            ))}
            {pending.length > 3 && (
              <Link href={ROUTES.consoleSolicitacoes} className="flex items-center justify-center gap-1 text-xs text-highlight hover:text-highlight/70 py-1 transition-colors">
                +{pending.length - 3} mais pendentes <ArrowRight className="h-3 w-3" />
              </Link>
            )}
            {approvedUser && (
              <div className="p-3 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] text-sm mt-2">
                <p className="font-medium text-emerald-700 dark:text-emerald-400 mb-1">Acesso liberado — WhatsApp aberto com as credenciais</p>
                <p className="text-muted-foreground text-xs">Senha de <span className="text-foreground">{approvedUser.email}</span>: <span className="font-mono">{approvedUser.tempPassword}</span></p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-base font-semibold text-foreground">Visão geral</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Últimos Profissionais</p>
                <Link href={ROUTES.consoleUsuarios} className="text-xs text-highlight hover:text-highlight/70 flex items-center gap-1 transition-colors">
                  Ver todos <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {professionals.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><UserRoundX /></EmptyMedia>
                    <EmptyTitle className="text-xs font-normal tracking-normal">Nenhum profissional aprovado</EmptyTitle>
                    <EmptyDescription className="text-xs">Aprove solicitações para ver os profissionais aqui.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {professionals.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border">
                      <div className="w-7 h-7 rounded-lg bg-blue-500/15 dark:bg-blue-500/10 border border-blue-500/25 dark:border-blue-500/20 flex items-center justify-center shrink-0">
                        <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">{p.specialty}</p>
                      </div>
                      <StatusBadge variant="user" status={p.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Atividades</p>
                <Link href={ROUTES.consoleSolicitacoes} className="text-xs text-highlight hover:text-highlight/70 flex items-center gap-1 transition-colors">
                  Histórico <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><ActivityIcon /></EmptyMedia>
                    <EmptyTitle className="text-xs font-normal tracking-normal">Nenhuma atividade ainda</EmptyTitle>
                    <EmptyDescription className="text-xs">As atividades aparecerão conforme solicitações chegarem.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {recent.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border">
                      <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${
                        r.status === 'approved'
                          ? 'bg-emerald-500/15 border-emerald-500/25 dark:bg-emerald-400/10 dark:border-emerald-400/20'
                          : 'bg-amber-500/15 border-amber-500/25 dark:bg-amber-400/10 dark:border-amber-400/20'
                      }`}>
                        {r.status === 'approved'
                          ? <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          : <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.status === 'approved' ? 'Aprovado' : 'Pendente'} · {new Date(r.createdAt).toLocaleDateString('pt-BR')}, {new Date(r.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
