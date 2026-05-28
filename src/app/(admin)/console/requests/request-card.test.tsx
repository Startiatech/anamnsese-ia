import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RequestCard } from './request-card'
import type { AccessRequest } from '@/lib/types'

function makeRequest(overrides: Partial<AccessRequest> = {}): AccessRequest {
  return {
    id: 'r1',
    name: 'Profissional Um Teste',
    email: 'profissionalumteste@gmail.com',
    specialty: 'Neurologia',
    phone: '(32) 99999-9999',
    message: 'Gostaria de testar a plataforma.',
    status: 'pending',
    createdAt: '2026-05-27T14:30:00.000Z',
    userPasswordIsTemp: false,
    ...overrides,
  } as AccessRequest
}

function noopHandlers() {
  return { onApprove: vi.fn(), onReject: vi.fn(), onViewCredentials: vi.fn() }
}

// jsdom não faz layout: scrollHeight/clientHeight são 0. Simulamos transbordo
// (clamp ativo) definindo scrollHeight > clientHeight no protótipo.
function mockOverflow(overflowing: boolean) {
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get() { return overflowing ? 100 : 40 },
  })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get() { return 40 },
  })
}

afterEach(() => {
  // remove os getters mockados do protótipo entre testes
  delete (HTMLElement.prototype as unknown as { scrollHeight?: number }).scrollHeight
  delete (HTMLElement.prototype as unknown as { clientHeight?: number }).clientHeight
})

describe('RequestCard', () => {
  it('shows name, full email and inline message', () => {
    const h = noopHandlers()
    render(<RequestCard request={makeRequest()} processing={false} {...h} />)
    expect(screen.getByText('Profissional Um Teste')).toBeInTheDocument()
    expect(screen.getByText('profissionalumteste@gmail.com')).toBeInTheDocument()
    expect(screen.getByText(/Gostaria de testar a plataforma/)).toBeInTheDocument()
    expect(screen.getByText(/27\/05\/2026/)).toBeInTheDocument()
  })

  it('does not render the message block when there is no message', () => {
    const h = noopHandlers()
    render(<RequestCard request={makeRequest({ message: undefined })} processing={false} {...h} />)
    expect(screen.queryByText(/Mensagem/i)).not.toBeInTheDocument()
  })

  it('renders Aprovar/Rejeitar for pending and calls handlers', async () => {
    const user = userEvent.setup()
    const h = noopHandlers()
    const req = makeRequest({ status: 'pending' })
    render(<RequestCard request={req} processing={false} {...h} />)

    await user.click(screen.getByRole('button', { name: /aprovar/i }))
    expect(h.onApprove).toHaveBeenCalledWith(req)

    await user.click(screen.getByRole('button', { name: /rejeitar/i }))
    expect(h.onReject).toHaveBeenCalledWith(req)
  })

  it('renders Ver credenciais for approved + temp password', async () => {
    const user = userEvent.setup()
    const h = noopHandlers()
    const req = makeRequest({ status: 'approved', userPasswordIsTemp: true })
    render(<RequestCard request={req} processing={false} {...h} />)
    const btn = screen.getByRole('button', { name: /ver credenciais/i })
    await user.click(btn)
    expect(h.onViewCredentials).toHaveBeenCalledWith(req)
  })

  it('renders no action buttons for rejected', () => {
    const h = noopHandlers()
    render(<RequestCard request={makeRequest({ status: 'rejected' })} processing={false} {...h} />)
    expect(screen.queryByRole('button', { name: /aprovar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /rejeitar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ver credenciais/i })).not.toBeInTheDocument()
  })

  it('expands and collapses a message that overflows the clamp', async () => {
    mockOverflow(true)
    const user = userEvent.setup()
    const h = noopHandlers()
    render(<RequestCard request={makeRequest({ message: 'a'.repeat(130) })} processing={false} {...h} />)
    await user.click(screen.getByRole('button', { name: /ver mais/i }))
    expect(screen.getByRole('button', { name: /ver menos/i })).toBeInTheDocument()
  })

  it('does not show "ver mais" when the message fits within the clamp', () => {
    mockOverflow(false)
    const h = noopHandlers()
    // mensagem longa em caracteres, mas que não transborda visualmente
    render(<RequestCard request={makeRequest({ message: 'a'.repeat(130) })} processing={false} {...h} />)
    expect(screen.queryByRole('button', { name: /ver mais/i })).not.toBeInTheDocument()
  })

  it('renders no action buttons for approved without temp password', () => {
    const h = noopHandlers()
    render(<RequestCard request={makeRequest({ status: 'approved', userPasswordIsTemp: false })} processing={false} {...h} />)
    expect(screen.queryByRole('button', { name: /ver credenciais/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /aprovar/i })).not.toBeInTheDocument()
  })

  it('disables actions and shows Aguarde when processing', () => {
    const h = noopHandlers()
    render(<RequestCard request={makeRequest({ status: 'pending' })} processing={true} {...h} />)
    const buttons = screen.getAllByRole('button', { name: /aguarde/i })
    expect(buttons).toHaveLength(2)
    buttons.forEach(btn => expect(btn).toBeDisabled())
  })
})
