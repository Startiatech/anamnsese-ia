import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DeleteAccountModal } from './delete-account-modal'

const { mockSaveFeedback, mockScheduleAccountDeletion, mockOnClose } = vi.hoisted(() => ({
  mockSaveFeedback:             vi.fn(),
  mockScheduleAccountDeletion:  vi.fn(),
  mockOnClose:                  vi.fn(),
}))

vi.mock('@/server/actions/feedback', () => ({
  saveFeedback:            mockSaveFeedback,
  scheduleAccountDeletion: mockScheduleAccountDeletion,
}))

vi.mock('sonner', () => ({
  toast: { promise: vi.fn((p: Promise<unknown>) => p) },
}))

describe('DeleteAccountModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('não renderiza quando open=false', () => {
    const { container } = render(<DeleteAccountModal open={false} onClose={mockOnClose} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renderiza conteúdo quando open=true', () => {
    render(<DeleteAccountModal open={true} onClose={mockOnClose} />)
    expect(screen.getByText(/excluir conta/i)).toBeInTheDocument()
    expect(screen.getByText(/lgpd/i)).toBeInTheDocument()
    expect(screen.getByText(/7 dias/i)).toBeInTheDocument()
  })

  it('chama onClose ao clicar no botão Cancelar', () => {
    render(<DeleteAccountModal open={true} onClose={mockOnClose} />)
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(mockOnClose).toHaveBeenCalledOnce()
  })

  it('chama onClose ao clicar no X', () => {
    render(<DeleteAccountModal open={true} onClose={mockOnClose} />)
    const closeBtn = screen.getAllByRole('button').find(b => b.querySelector('svg'))!
    fireEvent.click(closeBtn)
    expect(mockOnClose).toHaveBeenCalledOnce()
  })

  it('desabilita botões durante loading', async () => {
    mockSaveFeedback.mockResolvedValue({ feedbackId: 'fb-1' })
    mockScheduleAccountDeletion.mockReturnValue(new Promise(() => {})) // never resolves

    render(<DeleteAccountModal open={true} onClose={mockOnClose} />)
    fireEvent.click(screen.getByRole('button', { name: /confirmar exclusão/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /aguarde/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /cancelar/i })).toBeDisabled()
    })
  })

  it('fluxo happy path: chama saveFeedback → scheduleAccountDeletion', async () => {
    mockSaveFeedback.mockResolvedValue({ feedbackId: 'fb-42' })
    mockScheduleAccountDeletion.mockResolvedValue({ ok: true })

    render(<DeleteAccountModal open={true} onClose={mockOnClose} />)
    fireEvent.click(screen.getByRole('button', { name: /confirmar exclusão/i }))

    await waitFor(() => {
      expect(mockSaveFeedback).toHaveBeenCalledWith({
        rating: 1,
        message: 'Solicitado via configurações',
      })
      expect(mockScheduleAccountDeletion).toHaveBeenCalledWith('fb-42')
    })
  })

  it('não chama scheduleAccountDeletion quando saveFeedback retorna erro', async () => {
    mockSaveFeedback.mockResolvedValue({ error: 'Falhou' })

    render(<DeleteAccountModal open={true} onClose={mockOnClose} />)
    fireEvent.click(screen.getByRole('button', { name: /confirmar exclusão/i }))

    await waitFor(() => expect(mockSaveFeedback).toHaveBeenCalled())
    expect(mockScheduleAccountDeletion).not.toHaveBeenCalled()
  })

  it('não chama scheduleAccountDeletion quando saveFeedback não retorna feedbackId', async () => {
    mockSaveFeedback.mockResolvedValue({})

    render(<DeleteAccountModal open={true} onClose={mockOnClose} />)
    fireEvent.click(screen.getByRole('button', { name: /confirmar exclusão/i }))

    await waitFor(() => expect(mockSaveFeedback).toHaveBeenCalled())
    expect(mockScheduleAccountDeletion).not.toHaveBeenCalled()
  })

  it('modal permanece aberto quando scheduleAccountDeletion retorna erro', async () => {
    mockSaveFeedback.mockResolvedValue({ feedbackId: 'fb-1' })
    mockScheduleAccountDeletion.mockResolvedValue({ error: 'Falhou' })

    render(<DeleteAccountModal open={true} onClose={mockOnClose} />)
    fireEvent.click(screen.getByRole('button', { name: /confirmar exclusão/i }))

    await waitFor(() => expect(mockScheduleAccountDeletion).toHaveBeenCalled())
    expect(screen.getByText(/excluir conta/i)).toBeInTheDocument()
    expect(mockOnClose).not.toHaveBeenCalled()
  })
})
