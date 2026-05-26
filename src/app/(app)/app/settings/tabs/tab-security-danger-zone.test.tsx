import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TabSecurity } from './tab-security'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

const { mockCancelAccountDeletion } = vi.hoisted(() => ({
  mockCancelAccountDeletion: vi.fn(),
}))

vi.mock('@/server/actions/feedback', () => ({
  cancelAccountDeletion: mockCancelAccountDeletion,
}))

vi.mock('../delete-account-modal', () => ({
  DeleteAccountModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="delete-account-modal" /> : null,
}))

vi.mock('sonner', () => ({
  toast: { promise: vi.fn((p: Promise<unknown>) => p) },
}))

function renderTabSecurity(props: { deletionScheduledAt?: string | null; isOnboarding?: boolean } = {}) {
  return render(<TabSecurity userId="user-1" {...props} />)
}

describe('TabSecurity — zona de perigo', () => {
  beforeEach(() => vi.clearAllMocks())

  it('oculta zona de perigo durante onboarding', () => {
    renderTabSecurity({ isOnboarding: true })
    expect(screen.queryByText(/zona de perigo/i)).not.toBeInTheDocument()
  })

  it('exibe zona de perigo fora do onboarding', () => {
    renderTabSecurity()
    expect(screen.getByText(/zona de perigo/i)).toBeInTheDocument()
  })

  it('exibe botão "Solicitar exclusão" quando não há exclusão agendada', () => {
    renderTabSecurity({ deletionScheduledAt: null })
    expect(screen.getByRole('button', { name: /solicitar exclusão/i })).toBeInTheDocument()
    expect(screen.queryByText(/exclusão agendada/i)).not.toBeInTheDocument()
  })

  it('exibe estado de exclusão agendada com dias restantes', () => {
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
    renderTabSecurity({ deletionScheduledAt: future })
    expect(screen.getByText(/exclusão agendada/i)).toBeInTheDocument()
    expect(screen.getByText(/5 dias/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /solicitar exclusão/i })).not.toBeInTheDocument()
  })

  it('exibe botão "Cancelar exclusão" quando exclusão está agendada', () => {
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    renderTabSecurity({ deletionScheduledAt: future })
    expect(screen.getByRole('button', { name: /cancelar exclusão/i })).toBeInTheDocument()
  })

  it('abre DeleteAccountModal ao clicar em "Solicitar exclusão"', () => {
    renderTabSecurity({ deletionScheduledAt: null })
    expect(screen.queryByTestId('delete-account-modal')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /solicitar exclusão/i }))
    expect(screen.getByTestId('delete-account-modal')).toBeInTheDocument()
  })

  it('chama cancelAccountDeletion ao clicar em "Cancelar exclusão"', async () => {
    mockCancelAccountDeletion.mockResolvedValue({ ok: true })
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    renderTabSecurity({ deletionScheduledAt: future })

    fireEvent.click(screen.getByRole('button', { name: /cancelar exclusão/i }))

    await waitFor(() => expect(mockCancelAccountDeletion).toHaveBeenCalledOnce())
  })

  it('desabilita botão "Cancelar exclusão" durante a requisição', async () => {
    mockCancelAccountDeletion.mockReturnValue(new Promise(() => {})) // never resolves
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    renderTabSecurity({ deletionScheduledAt: future })

    fireEvent.click(screen.getByRole('button', { name: /cancelar exclusão/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /aguarde/i })).toBeDisabled()
    })
  })
})
