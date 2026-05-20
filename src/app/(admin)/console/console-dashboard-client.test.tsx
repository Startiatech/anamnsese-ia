import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { ConsoleDashboardClient, type ProfessionalRow } from './console-dashboard-client'
import type { AccessRequest } from '@/lib/types'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

const mockUseConsoleNotification = vi.fn()

vi.mock('@/context/console-notification-context', () => ({
  useConsoleNotification: () => mockUseConsoleNotification(),
}))

vi.mock('sonner', () => ({
  toast: { promise: vi.fn(), success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/routes', () => ({
  ROUTES: {
    consoleSolicitacoes: '/console/solicitacoes',
    consoleUsuarios: '/console/usuarios',
  },
}))

vi.mock('@/components/console/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}))

vi.mock('@/lib/currency', () => ({
  formatBRL: (v: number) => `R$ ${v.toFixed(2)}`,
}))

function makeProfessional(overrides: Partial<ProfessionalRow> = {}): ProfessionalRow {
  return {
    id: 'u-1',
    name: 'Dr. João',
    email: 'doctor@example.com',
    specialty: 'Cardiologia',
    status: 'active',
    ...overrides,
  }
}

function renderDashboard(props: {
  professionals?: ProfessionalRow[]
  requests?: AccessRequest[]
} = {}) {
  const requests = props.requests ?? []
  mockUseConsoleNotification.mockReturnValue({ requests, setRequests: vi.fn() })

  return render(
    <ConsoleDashboardClient
      initialRequests={requests}
      professionals={props.professionals ?? []}
    />,
  )
}

describe('ConsoleDashboardClient — Últimos Profissionais', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exibe "Ativo" para profissional com status active', () => {
    renderDashboard({
      professionals: [makeProfessional({ status: 'active' })],
    })

    expect(screen.getByText('Ativo')).toBeDefined()
  })

  it('exibe "Onboarding" para profissional com status onboarding', () => {
    renderDashboard({
      professionals: [makeProfessional({ status: 'onboarding' })],
    })

    expect(screen.getByText('Onboarding')).toBeDefined()
  })

  it('exibe "Bloqueado" para profissional com status blocked', () => {
    renderDashboard({
      professionals: [makeProfessional({ status: 'blocked' })],
    })

    expect(screen.getByText('Bloqueado')).toBeDefined()
  })

  it('exibe o profissional mesmo sem access_request correspondente', () => {
    renderDashboard({
      professionals: [makeProfessional({ name: 'Dr. Direto', status: 'active' })],
      requests: [],
    })

    expect(screen.getByText('Dr. Direto')).toBeDefined()
    expect(screen.getByText('Ativo')).toBeDefined()
  })

  it('exibe estado vazio quando professionals está vazio', () => {
    renderDashboard({ professionals: [] })

    expect(screen.getByText('Nenhum profissional aprovado')).toBeDefined()
  })

  it('exibe estado vazio quando professionals não é fornecido', () => {
    renderDashboard()

    expect(screen.getByText('Nenhum profissional aprovado')).toBeDefined()
  })
})
