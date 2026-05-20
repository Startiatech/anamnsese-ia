// src/components/layout/deletion-banner.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DeletionBanner } from './deletion-banner'

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
  toast: { promise: vi.fn((p: Promise<unknown>) => p), success: vi.fn() },
}))

describe('DeletionBanner', () => {
  beforeEach(() => vi.clearAllMocks())

  it('nao renderiza quando deletionScheduledAt é null', () => {
    const { container } = render(<DeletionBanner deletionScheduledAt={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renderiza banner com dias restantes', () => {
    const future = new Date()
    future.setDate(future.getDate() + 7)
    render(<DeletionBanner deletionScheduledAt={future.toISOString()} />)
    expect(screen.getByText(/será encerrada/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument()
  })

  it('chama cancelAccountDeletion ao clicar Cancelar', async () => {
    mockCancelAccountDeletion.mockResolvedValue({ ok: true })
    const future = new Date()
    future.setDate(future.getDate() + 3)
    render(<DeletionBanner deletionScheduledAt={future.toISOString()} />)

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))
    await waitFor(() => expect(mockCancelAccountDeletion).toHaveBeenCalledOnce())
    expect(mockRefresh).toHaveBeenCalled()
  })
})
