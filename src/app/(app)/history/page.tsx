import { redirect } from 'next/navigation'
import { getServerUser } from '@/server/services/session'
import { PatientRepository, ConsultationRepository } from '@/server/repositories/db'
import { PageHeader } from '@/components/console/page-header'
import { ROUTES } from '@/lib/routes'
import { HistoryClient } from './history-client'

export const dynamic = 'force-dynamic'

const HISTORY_PAGE_SIZE = 20

export default async function HistoricoPage() {
  const user = await getServerUser()
  if (!user) redirect(ROUTES.login)

  const [patients, consultations] = await Promise.all([
    PatientRepository.findAll(user.sub),
    ConsultationRepository.findAll(user.sub, { limit: HISTORY_PAGE_SIZE }),
  ])

  const patientsById = Object.fromEntries(patients.map((p) => [p.id, p]))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Histórico"
        description="Todos os atendimentos realizados."
      />

      <div>
        <h2 className="text-base font-semibold text-foreground mb-3">Atendimentos</h2>
        <div
          className="rounded-xl border border-border overflow-hidden bg-card"
        >
          <HistoryClient
            consultations={consultations}
            patientsById={patientsById}
            hasMore={consultations.length === HISTORY_PAGE_SIZE}
          />
        </div>
      </div>
    </div>
  )
}
