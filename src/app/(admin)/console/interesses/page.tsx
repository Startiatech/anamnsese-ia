import { PlanInterestRepository } from '@/server/repositories/plan-interest'
import { InteressesClient } from './interesses-client'

export default async function InteressesPage() {
  const interests = await PlanInterestRepository.list()
  return <InteressesClient interests={interests} />
}
