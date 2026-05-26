import { redirect } from 'next/navigation'
import { getServerUser } from '@/server/services/session'
import { findUserById } from '@/server/repositories/users'
import { PlanRepository } from '@/server/repositories/plans'
import { PageHeader } from '@/components/console/page-header'
import { PlanCard } from '@/components/plans/plan-card'
import { DeletionWarning } from '@/components/plans/deletion-warning'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { CreditCard } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PlanosPage() {
  const user = await getServerUser()
  if (!user) redirect('/login')

  const [plans, userPlan, storedUser] = await Promise.all([
    PlanRepository.listActive(),
    PlanRepository.getUserPlan(user.sub),
    findUserById(user.sub),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Planos"
        description="Escolha o plano ideal para sua jornada clínica com IA."
      />

      {storedUser?.deletionScheduledAt && (
        <DeletionWarning deletionScheduledAt={storedUser.deletionScheduledAt} />
      )}

      <div>
        <h2 className="text-base font-semibold text-foreground mb-3">Planos disponíveis</h2>
        {plans.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><CreditCard /></EmptyMedia>
              <EmptyTitle className="text-sm font-medium">Nenhum plano disponível</EmptyTitle>
              <EmptyDescription className="text-xs">Nenhum plano está disponível no momento.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col gap-3">
            {plans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} isCurrent={userPlan.planSelected && plan.id === userPlan.planId} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
