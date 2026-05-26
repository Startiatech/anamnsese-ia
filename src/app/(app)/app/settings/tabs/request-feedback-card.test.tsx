import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RequestFeedbackCard } from './request-feedback-card'

const { mockSubmit, mockToastPromise } = vi.hoisted(() => ({
  mockSubmit: vi.fn(),
  mockToastPromise: vi.fn((p: Promise<unknown>) => p),
}))

vi.mock('@/server/actions/accessibility-requests', () => ({
  submitAccessibilityRequest: mockSubmit,
}))

vi.mock('sonner', () => ({
  toast: { promise: mockToastPromise, error: vi.fn(), success: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockSubmit.mockResolvedValue({ ok: true, id: 'req-1' })
})

afterEach(() => vi.restoreAllMocks())

describe('RequestFeedbackCard', () => {
  it('renderiza textarea, contador e botao Enviar', () => {
    render(<RequestFeedbackCard />)

    expect(screen.getByRole('textbox', { name: /pedido|conte/i })).toBeTruthy()
    expect(screen.getByText(/0 \/ 500/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /enviar/i })).toBeTruthy()
  })

  it('contador atualiza enquanto o usuario digita', async () => {
    const user = userEvent.setup()
    render(<RequestFeedbackCard />)

    const textarea = screen.getByRole('textbox', { name: /pedido|conte/i })
    await user.type(textarea, 'oi')

    expect(screen.getByText(/2 \/ 500/)).toBeTruthy()
  })

  it('botao Enviar fica desabilitado quando mensagem < 10 chars', async () => {
    const user = userEvent.setup()
    render(<RequestFeedbackCard />)

    const submit = screen.getByRole('button', { name: /enviar/i })
    expect(submit).toBeDisabled()

    await user.type(screen.getByRole('textbox', { name: /pedido|conte/i }), 'curto')
    expect(submit).toBeDisabled()
  })

  it('botao Enviar habilita com >= 10 chars', async () => {
    const user = userEvent.setup()
    render(<RequestFeedbackCard />)

    await user.type(screen.getByRole('textbox', { name: /pedido|conte/i }), 'Mensagem com mais de dez caracteres')

    expect(screen.getByRole('button', { name: /enviar/i })).not.toBeDisabled()
  })

  it('clicar Enviar chama submitAccessibilityRequest com a mensagem', async () => {
    const user = userEvent.setup()
    render(<RequestFeedbackCard />)

    await user.type(screen.getByRole('textbox', { name: /pedido|conte/i }), 'Quero fonte para dislexia')
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /enviar/i }))
    })

    expect(mockSubmit).toHaveBeenCalledWith({ message: 'Quero fonte para dislexia' })
  })

  it('apos sucesso: mostra mensagem inline e limpa o textarea', async () => {
    const user = userEvent.setup()
    render(<RequestFeedbackCard />)

    const textarea = screen.getByRole('textbox', { name: /pedido|conte/i }) as HTMLTextAreaElement
    await user.type(textarea, 'Mensagem valida com mais de dez caracteres')
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /enviar/i }))
    })

    expect(screen.getByText(/pedido enviado.*obrigado/i)).toBeTruthy()
    expect(textarea.value).toBe('')
  })

  it('apos erro: mantem texto no campo', async () => {
    mockSubmit.mockResolvedValueOnce({ ok: false, error: 'Erro generico' })
    const user = userEvent.setup()
    render(<RequestFeedbackCard />)

    const textarea = screen.getByRole('textbox', { name: /pedido|conte/i }) as HTMLTextAreaElement
    await user.type(textarea, 'Pedido teste com erro de envio')
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /enviar/i }))
    })

    expect(textarea.value).toBe('Pedido teste com erro de envio')
  })

  it('botao mostra "Aguarde..." durante o envio', async () => {
    let resolveSubmit!: (v: { ok: boolean; id?: string }) => void
    mockSubmit.mockReturnValueOnce(new Promise<{ ok: boolean; id?: string }>((res) => { resolveSubmit = res }))
    const user = userEvent.setup()
    render(<RequestFeedbackCard />)

    await user.type(screen.getByRole('textbox', { name: /pedido|conte/i }), 'Pedido valido testando loading')
    await user.click(screen.getByRole('button', { name: /enviar/i }))

    expect(screen.getByText(/aguarde/i)).toBeTruthy()

    await act(async () => {
      resolveSubmit({ ok: true, id: 'r1' })
      await Promise.resolve()
    })
    await waitFor(() => expect(screen.queryByText(/aguarde/i)).toBeNull())
  })

  it('mensagem de sucesso some apos 5 segundos', async () => {
    render(<RequestFeedbackCard />)
    const textarea = screen.getByRole('textbox', { name: /pedido|conte/i }) as HTMLTextAreaElement

    // Usa fireEvent (sincrono) em vez de userEvent (que usa timers internos)
    fireEvent.change(textarea, { target: { value: 'Mensagem valida com mais de dez' } })

    vi.useFakeTimers()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /enviar/i }))
      // Drena a promise sintetica do submitAccessibilityRequest
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(screen.getByText(/pedido enviado.*obrigado/i)).toBeTruthy()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5100)
    })

    expect(screen.queryByText(/pedido enviado.*obrigado/i)).toBeNull()
    vi.useRealTimers()
  })
})
