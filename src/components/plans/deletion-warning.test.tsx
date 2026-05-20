// src/components/plans/deletion-warning.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DeletionWarning } from './deletion-warning'

const { mockCancelAccountDeletion, mockRefresh } = vi.hoisted(() => ({
  mockCancelAccountDeletion: vi.fn(),
  mockRefresh: vi.fn(),
}))

vi.mock('@/server/actions/feedback', () => ({
  cancelAccountDeletion: mockCancelAccountDeletion,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

vi.mock('sonner', () => ({
  toast: { promise: vi.fn((p: Promise<unknown>) => p) },
}))

describe('DeletionWarning', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renderiza aviso com dias restantes', () => {
    const future = new Date()
    future.setDate(future.getDate() + 5)
    render(<DeletionWarning deletionScheduledAt={future.toISOString()} />)
    expect(screen.getByText(/agendada para exclusão/i)).toBeInTheDocument()
    expect(screen.getByText(/5 dias/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancelar exclusão/i })).toBeInTheDocument()
  })

  it('usa singular quando resta 1 dia', () => {
    const future = new Date()
    future.setDate(future.getDate() + 1)
    render(<DeletionWarning deletionScheduledAt={future.toISOString()} />)
    expect(screen.getByText(/1 dia\b/i)).toBeInTheDocument()
  })

  it('chama cancelAccountDeletion ao clicar e faz router.refresh', async () => {
    mockCancelAccountDeletion.mockResolvedValue({ ok: true })
    const future = new Date()
    future.setDate(future.getDate() + 3)
    render(<DeletionWarning deletionScheduledAt={future.toISOString()} />)

    fireEvent.click(screen.getByRole('button', { name: /cancelar exclusão/i }))
    await waitFor(() => expect(mockCancelAccountDeletion).toHaveBeenCalledOnce())
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('nao chama router.refresh quando cancelAccountDeletion retorna erro', async () => {
    mockCancelAccountDeletion.mockResolvedValue({ error: 'Unauthorized' })
    const future = new Date()
    future.setDate(future.getDate() + 3)
    render(<DeletionWarning deletionScheduledAt={future.toISOString()} />)

    fireEvent.click(screen.getByRole('button', { name: /cancelar exclusão/i }))
    await waitFor(() => expect(mockCancelAccountDeletion).toHaveBeenCalledOnce())
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('desabilita o botão enquanto cancela', async () => {
    let resolve!: (v: unknown) => void
    mockCancelAccountDeletion.mockReturnValue(new Promise((r) => { resolve = r }))
    const future = new Date()
    future.setDate(future.getDate() + 3)
    render(<DeletionWarning deletionScheduledAt={future.toISOString()} />)

    const btn = screen.getByRole('button', { name: /cancelar exclusão/i })
    fireEvent.click(btn)
    expect(btn).toBeDisabled()
    resolve({ ok: true })
  })
})
