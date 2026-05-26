'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { useApp } from '@/context/app-context'
import { PageHeader } from '@/components/console/page-header'
import { Button } from '@/components/ui/button'

function getGreeting(hour: number): string {
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

interface GreetingSectionProps {
  weekCount: number
}

export function GreetingSection({ weekCount }: GreetingSectionProps) {
  const { user, credits } = useApp()

  const blocked = credits === 0
  const firstName = user?.name?.split(' ')[0] ?? ''
  const title = `${getGreeting(new Date().getHours())}, ${firstName}!`
  const description = weekCount === 0
    ? 'Nenhum atendimento esta semana.'
    : weekCount === 1
    ? '1 atendimento realizado esta semana.'
    : `${weekCount} atendimentos realizados esta semana.`

  const action = (
    <Link
      href="/app/consultation"
      aria-disabled={blocked}
      tabIndex={blocked ? -1 : undefined}
      className={blocked ? 'pointer-events-none' : ''}
    >
      <Button size="lg" disabled={blocked}>
        <Plus className="h-3.5 w-3.5" />
        Novo atendimento
      </Button>
    </Link>
  )

  return <PageHeader title={title} description={description} action={action} />
}
