import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TrialEndModal } from './trial-end-modal'

const { mockSaveFeedback, mockScheduleAccountDeletion, mockMarkFeedbackUpgrade, mockPush, mockHardNavigate } = vi.hoisted(() => ({
  mockSaveFeedback: vi.fn(),
  mockScheduleAccountDeletion: vi.fn(),
  mockMarkFeedbackUpgrade: vi.fn(),
  mockPush: vi.fn(),
  mockHardNavigate: vi.fn(),
}))

vi.mock('@/server/actions/feedback', () => ({
  saveFeedback: mockSaveFeedback,
  scheduleAccountDeletion: mockScheduleAccountDeletion,
  markFeedbackUpgrade: mockMarkFeedbackUpgrade,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('@/lib/navigation', () => ({
  hardNavigate: mockHardNavigate,
}))

vi.mock('sonner', () => ({
  toast: { promise: vi.fn((p: Promise<unknown>) => p), error: vi.fn(), success: vi.fn() },
}))

describe('TrialEndModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renderiza step de feedback com estrelas', () => {
    render(<TrialEndModal open={true} />)
    expect(screen.getByText(/período de teste chegou ao fim/i)).toBeInTheDocument()
    expect(screen.getByText(/avaliação/i)).toBeInTheDocument()
  })

  it('botao Avançar fica desabilitado sem selecionar estrelas', () => {
    render(<TrialEndModal open={true} />)
    const btn = screen.getByRole('button', { name: /avançar/i })
    expect(btn).toBeDisabled()
  })

  it('habilita Avançar ao selecionar estrela', () => {
    render(<TrialEndModal open={true} />)
    const stars = screen.getAllByRole('button', { name: /estrela/i })
    fireEvent.click(stars[4])
    expect(screen.getByRole('button', { name: /avançar/i })).not.toBeDisabled()
  })

  it('avanca para step de decisao ao clicar Avançar', async () => {
    mockSaveFeedback.mockResolvedValue({ feedbackId: 'fb-1' })
    render(<TrialEndModal open={true} />)

    const stars = screen.getAllByRole('button', { name: /estrela/i })
    fireEvent.click(stars[4])
    fireEvent.click(screen.getByRole('button', { name: /avançar/i }))

    await waitFor(() => {
      expect(screen.getByText(/o que deseja fazer agora/i)).toBeInTheDocument()
    })
  })

  it('navega para /plans ao clicar Ver planos', async () => {
    mockSaveFeedback.mockResolvedValue({ feedbackId: 'fb-1' })
    mockMarkFeedbackUpgrade.mockResolvedValue(undefined)
    render(<TrialEndModal open={true} />)

    const stars = screen.getAllByRole('button', { name: /estrela/i })
    fireEvent.click(stars[2])
    fireEvent.click(screen.getByRole('button', { name: /avançar/i }))

    await waitFor(() => screen.getByText(/o que deseja fazer agora/i))
    fireEvent.click(screen.getByRole('button', { name: /ver planos/i }))

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/plans'))
  })

  it('chama markFeedbackUpgrade e navega ao clicar Ver planos', async () => {
    mockSaveFeedback.mockResolvedValue({ feedbackId: 'fb-1' })
    mockMarkFeedbackUpgrade.mockResolvedValue(undefined)
    render(<TrialEndModal open={true} />)

    const stars = screen.getAllByRole('button', { name: /estrela/i })
    fireEvent.click(stars[2])
    fireEvent.click(screen.getByRole('button', { name: /avançar/i }))

    await waitFor(() => screen.getByText(/o que deseja fazer agora/i))
    fireEvent.click(screen.getByRole('button', { name: /ver planos/i }))

    await waitFor(() => {
      expect(mockMarkFeedbackUpgrade).toHaveBeenCalledWith('fb-1', 'upgrade_modal')
      expect(mockPush).toHaveBeenCalledWith('/plans')
    })
  })

  it('avanca para step de confirmacao ao clicar Encerrar', async () => {
    mockSaveFeedback.mockResolvedValue({ feedbackId: 'fb-1' })
    render(<TrialEndModal open={true} />)

    const stars = screen.getAllByRole('button', { name: /estrela/i })
    fireEvent.click(stars[0])
    fireEvent.click(screen.getByRole('button', { name: /avançar/i }))
    await waitFor(() => screen.getByText(/o que deseja fazer agora/i))

    fireEvent.click(screen.getByRole('button', { name: /encerrar período/i }))
    await waitFor(() => {
      expect(screen.getByText(/exclusão crítica/i)).toBeInTheDocument()
    })
  })

  it('redireciona para /dashboard (nao /login) apos confirmar encerramento', async () => {
    mockSaveFeedback.mockResolvedValue({ feedbackId: 'fb-1' })
    mockScheduleAccountDeletion.mockResolvedValue(undefined)
    render(<TrialEndModal open={true} />)

    const stars = screen.getAllByRole('button', { name: /estrela/i })
    fireEvent.click(stars[0])
    fireEvent.click(screen.getByRole('button', { name: /avançar/i }))
    await waitFor(() => screen.getByText(/o que deseja fazer agora/i))

    fireEvent.click(screen.getByRole('button', { name: /encerrar período/i }))
    await waitFor(() => screen.getByText(/exclusão crítica/i))

    fireEvent.click(screen.getByRole('button', { name: /confirmar encerramento/i }))
    await waitFor(() => {
      expect(mockScheduleAccountDeletion).toHaveBeenCalledWith('fb-1')
      expect(mockHardNavigate).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('nao fecha com ESC ou clique externo — modal permanece aberto', () => {
    render(<TrialEndModal open={true} />)
    expect(screen.getByText(/período de teste chegou ao fim/i)).toBeInTheDocument()
  })
})
