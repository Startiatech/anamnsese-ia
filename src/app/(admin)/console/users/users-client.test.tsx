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

  it('exibe todos os usuários sem filtro aplicado', () => {
    render(<UsersClient initialUsers={users} />)
    expect(screen.getByText('Ana Silva')).toBeInTheDocument()
    expect(screen.getByText('Bruno Matos')).toBeInTheDocument()
    expect(screen.getByText('Carla Dias')).toBeInTheDocument()
  })

  it('filtra por nome (case-insensitive)', () => {
    render(<UsersClient initialUsers={users} />)
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: 'ana' } })
    expect(screen.getByText('Ana Silva')).toBeInTheDocument()
    expect(screen.queryByText('Bruno Matos')).not.toBeInTheDocument()
    expect(screen.queryByText('Carla Dias')).not.toBeInTheDocument()
  })

  it('filtra por email', () => {
    render(<UsersClient initialUsers={users} />)
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: 'bruno@' } })
    expect(screen.queryByText('Ana Silva')).not.toBeInTheDocument()
    expect(screen.getByText('Bruno Matos')).toBeInTheDocument()
  })

  it('filtra por status bloqueado', () => {
    render(<UsersClient initialUsers={users} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'blocked' } })
    expect(screen.queryByText('Ana Silva')).not.toBeInTheDocument()
    expect(screen.getByText('Bruno Matos')).toBeInTheDocument()
    expect(screen.queryByText('Carla Dias')).not.toBeInTheDocument()
  })

  it('filtra por status onboarding', () => {
    render(<UsersClient initialUsers={users} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'onboarding' } })
    expect(screen.queryByText('Ana Silva')).not.toBeInTheDocument()
    expect(screen.queryByText('Bruno Matos')).not.toBeInTheDocument()
    expect(screen.getByText('Carla Dias')).toBeInTheDocument()
  })

  it('combina filtro de texto e status', () => {
    render(<UsersClient initialUsers={users} />)
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: 'a' } })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'active' } })
    expect(screen.getByText('Ana Silva')).toBeInTheDocument()
    expect(screen.queryByText('Bruno Matos')).not.toBeInTheDocument()
    expect(screen.queryByText('Carla Dias')).not.toBeInTheDocument()
  })

  it('exibe mensagem quando filtro não retorna resultados', () => {
    render(<UsersClient initialUsers={users} />)
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: 'zzzninguem' } })
    expect(screen.getByText(/nenhum usuário encontrado/i)).toBeInTheDocument()
  })
})
