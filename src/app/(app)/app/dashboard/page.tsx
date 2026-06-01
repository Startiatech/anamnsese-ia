import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth-server'
import { PatientRepository, ConsultationRepository } from '@/lib/db'
import { ConsultationRepository as ConsultationRepo } from '@/server/repositories/db'
import { findUserById } from '@/server/repositories/users'
import { GreetingSection } from '@/components/dashboard/greeting-section'
import { MetricsRow } from '@/components/dashboard/metrics-row'
import { CreditWidget } from '@/components/dashboard/credit-widget'
import { WeeklyChart } from '@/components/dashboard/weekly-chart'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { WelcomeModal } from '@/components/dashboard/welcome-modal'
import { LoginToast } from '@/components/dashboard/login-toast'
import { TimeSavedCard } from '@/components/dashboard/time-saved-card'
import { DeletionBanner } from '@/components/dashboard/deletion-banner'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { reconcileStaleConsultations } from '@/server/actions/consultation'

export const dynamic = 'force-dynamic'

function getStartOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getStartOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; login?: string }>
}) {
  const user = await getServerUser()
  if (!user) redirect('/login')
  if (user.role === 'admin' || user.role === 'master') redirect('/console')

  const { welcome, login } = await searchParams
  const showWelcome = welcome === '1'
  const showLoginToast = login === '1'

  // Rede de proteção: ao abrir o dashboard, recupera créditos de atendimentos
  // in_progress órfãos parados há mais de 24h (aba fechada sem concluir).
  await reconcileStaleConsultations()

  const [patients, consultations, todayCount, weekCount, monthCount, storedUser] = await Promise.all([
    PatientRepository.findAll(user.sub),
    ConsultationRepository.findAll(user.sub),
    ConsultationRepo.countByPeriod(user.sub, 'today'),
    ConsultationRepo.countByPeriod(user.sub, 'week'),
    ConsultationRepo.countByPeriod(user.sub, 'month'),
    findUserById(user.sub),
  ])

  const minutesPerConsultation = storedUser?.minutesPerConsultation ?? 45

  const now = new Date()
  const weekStartStr = getStartOfWeek(now).toISOString()
  const monthStartStr = getStartOfMonth(now).toISOString()

  const consultationsThisWeek = consultations.filter((c) => (c.createdAt ?? '') >= weekStartStr).length
  const consultationsThisMonth = consultations.filter((c) => (c.createdAt ?? '') >= monthStartStr).length
  const weekConsultations = consultations.filter((c) => (c.createdAt ?? '') >= weekStartStr)

  const deletionScheduledAt = storedUser?.deletionScheduledAt ?? null

  return (
    <div className="space-y-6">
      {deletionScheduledAt && <DeletionBanner deletionScheduledAt={deletionScheduledAt} />}
      <GreetingSection weekCount={consultationsThisWeek} />

      <div>
        <h2 className="text-base font-semibold text-foreground mb-3">Métricas</h2>
        <MetricsRow
          totalPatients={patients.length}
          consultationsThisMonth={consultationsThisMonth}
          consultationsThisWeek={consultationsThisWeek}
        />
      </div>

      <TimeSavedCard todayCount={todayCount} weekCount={weekCount} monthCount={monthCount} minutesPerConsultation={minutesPerConsultation} />

      <div>
        <h2 className="text-base font-semibold text-foreground mb-3">Visão geral</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <p className="text-xs text-muted-foreground">Atendimentos esta semana</p>
            </CardHeader>
            <CardContent>
              <WeeklyChart consultations={weekConsultations} />
            </CardContent>
          </Card>

          <CreditWidget />
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold text-foreground mb-3">Atividade recente</h2>
        <RecentActivity consultations={consultations} patients={patients} />
      </div>

      <WelcomeModal show={showWelcome} userName={user.name} />
      {showLoginToast && <LoginToast userName={user.name} />}
    </div>
  )
}
