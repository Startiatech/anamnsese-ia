import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { UsersClient, type UserRow } from './users-client'

vi.mock('@/lib/routes', () => ({
  API: { adminUserId: (id: string) => `/api/admin/users/${id}` },
}))

vi.mock('sonner', () => ({
  toast: { promise: vi.fn(), error: vi.fn() },
}))

vi.mock('./add-user-modal', () => ({ AddUserModal: () => null }))
vi.mock('./edit-user-modal', () => ({ EditUserModal: () => null }))
vi.mock('./delete-user-modal', () => ({ DeleteUserModal: () => null }))
vi.mock('./inject-credits-modal', () => ({ InjectCreditsModal: () => null }))
vi.mock('./reset-pin-modal', () => ({ ResetPinModal: () => null }))
vi.mock('@/components/console/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}))

vi.mock('@/server/repositories/usage', () => ({
  UsageRepository: { logApiUsage: vi.fn(), getCostByUser: vi.fn() },
  calcLlamaCost: vi.fn(),
  calcWhisperCost: vi.fn(),
}))

vi.mock('@/server/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode }) => (
    <select role="combobox" value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}))

function makeUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: 'u-1',
    name: 'Ana Silva',
    email: 'ana@example.com',
    specialty: 'Cardiologia',
    createdAt: '2024-01-01T00:00:00Z',
    blocked: false,
    credits: 10,
    groqCost: 0,
    status: 'active',
    hasPin: false,
    pinIsTemp: false,
    ...overrides,
  }
}

const users: UserRow[] = [
  makeUser({ id: 'u-1', name: 'Ana Silva', email: 'ana@example.com', status: 'active' }),
  makeUser({ id: 'u-2', name: 'Bruno Matos', email: 'bruno@example.com', status: 'blocked', blocked: true }),
  makeUser({ id: 'u-3', name: 'Carla Dias', email: 'carla@example.com', status: 'onboarding' }),
]

describe('UsersClient — filtros', () => {
  beforeEach(() => vi.clearAllMocks())

  // A lista tem duas apresentacoes simultaneas no DOM: cards (md:hidden) e
  // tabela (hidden md:block). jsdom nao aplica CSS de breakpoint, entao um nome
  // aparece em ambas. Conta-se presenca por >=1 ocorrencia / ausencia por 0.
  const shown = (name: string) => expect(screen.getAllByText(name).length).toBeGreaterThan(0)
  const absent = (name: string) => expect(screen.queryAllByText(name)).toHaveLength(0)

  it('exibe todos os usuários sem filtro aplicado', () => {
    render(<UsersClient initialUsers={users} />)
    shown('Ana Silva')
    shown('Bruno Matos')
    shown('Carla Dias')
  })

  it('filtra por nome (case-insensitive)', () => {
    render(<UsersClient initialUsers={users} />)
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: 'ana' } })
    shown('Ana Silva')
    absent('Bruno Matos')
    absent('Carla Dias')
  })

  it('filtra por email', () => {
    render(<UsersClient initialUsers={users} />)
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: 'bruno@' } })
    absent('Ana Silva')
    shown('Bruno Matos')
  })

  it('filtra por status bloqueado', () => {
    render(<UsersClient initialUsers={users} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'blocked' } })
    absent('Ana Silva')
    shown('Bruno Matos')
    absent('Carla Dias')
  })

  it('filtra por status onboarding', () => {
    render(<UsersClient initialUsers={users} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'onboarding' } })
    absent('Ana Silva')
    absent('Bruno Matos')
    shown('Carla Dias')
  })

  it('combina filtro de texto e status', () => {
    render(<UsersClient initialUsers={users} />)
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: 'a' } })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'active' } })
    shown('Ana Silva')
    absent('Bruno Matos')
    absent('Carla Dias')
  })

  it('exibe mensagem quando filtro não retorna resultados', () => {
    render(<UsersClient initialUsers={users} />)
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: 'zzzninguem' } })
    expect(screen.getByText(/nenhum usuário encontrado/i)).toBeInTheDocument()
  })
})
