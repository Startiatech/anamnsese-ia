import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TabAccessibility } from './tab-accessibility'
import { AccessibilityProvider } from '@/context/accessibility-context'

// Isola a aba do card de pedido (que importa Server Action com supabase)
vi.mock('./request-feedback-card', () => ({
  RequestFeedbackCard: () => <div data-testid="request-feedback-card-mock" />,
}))

interface ProviderOpts {
  fontSize?: 'normal' | 'large' | 'xlarge'
  highContrast?: boolean
  spacingIncreased?: boolean
  focusHighlight?: boolean
  extraReducedMotion?: boolean
}

function renderWithProvider(opts: ProviderOpts = {}, props: { showRequestCard?: boolean } = {}) {
  return render(
    <AccessibilityProvider
      initialFontSize={opts.fontSize ?? 'normal'}
      initialHighContrast={opts.highContrast ?? false}
      initialSpacingIncreased={opts.spacingIncreased ?? false}
      initialFocusHighlight={opts.focusHighlight ?? false}
      initialExtraReducedMotion={opts.extraReducedMotion ?? false}
    >
      <TabAccessibility showRequestCard={props.showRequestCard} />
    </AccessibilityProvider>
  )
}

beforeEach(() => {
  vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ ok: true }) } as Response)
  localStorage.clear()
  for (const a of ['data-font-size', 'data-high-contrast', 'data-spacing-increased', 'data-focus-highlight', 'data-extra-reduced-motion']) {
    document.documentElement.removeAttribute(a)
  }
})

afterEach(() => vi.restoreAllMocks())

describe('TabAccessibility — base (sempre visivel)', () => {
  it('renderiza 3 opcoes de tamanho de fonte', () => {
    renderWithProvider()
    expect(screen.getByRole('radio', { name: /normal/i })).toBeTruthy()
    expect(screen.getByRole('radio', { name: /^grande$/i })).toBeTruthy()
    expect(screen.getByRole('radio', { name: /extra grande/i })).toBeTruthy()
  })

  it('marca a opcao de fonte atual como selecionada', () => {
    renderWithProvider({ fontSize: 'large' })
    const grande = screen.getByRole('radio', { name: /^grande$/i }) as HTMLInputElement
    expect(grande.checked).toBe(true)
  })

  it('selecionar "Extra grande" muda o data-font-size no <html>', async () => {
    const user = userEvent.setup()
    renderWithProvider()

    await user.click(screen.getByRole('radio', { name: /extra grande/i }))

    expect(document.documentElement.getAttribute('data-font-size')).toBe('xlarge')
  })

  it('renderiza toggle de alto contraste refletindo o estado atual', () => {
    renderWithProvider({ highContrast: true })
    const toggle = screen.getByRole('switch', { name: /alto contraste/i }) as HTMLInputElement
    expect(toggle.getAttribute('aria-checked')).toBe('true')
  })

  it('clicar no toggle de alto contraste muda data-high-contrast', async () => {
    const user = userEvent.setup()
    renderWithProvider()

    await user.click(screen.getByRole('switch', { name: /alto contraste/i }))

    expect(document.documentElement.getAttribute('data-high-contrast')).toBe('true')
  })

  it('mudancas disparam PATCH no servidor', async () => {
    const user = userEvent.setup()
    renderWithProvider()

    await user.click(screen.getByRole('radio', { name: /^grande$/i }))

    expect(global.fetch).toHaveBeenCalledWith('/api/users/me', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ prefFontSize: 'large' }),
    }))
  })
})

describe('TabAccessibility — Fase 3 (GA, sempre visivel)', () => {
  it('renderiza os 3 toggles', () => {
    renderWithProvider()
    expect(screen.getByRole('switch', { name: /espa.amento/i })).toBeTruthy()
    expect(screen.getByRole('switch', { name: /destacar foco/i })).toBeTruthy()
    expect(screen.getByRole('switch', { name: /reduzir movimento/i })).toBeTruthy()
  })

  it('clicar no toggle de espacamento aplica data-spacing-increased', async () => {
    const user = userEvent.setup()
    renderWithProvider()

    await user.click(screen.getByRole('switch', { name: /espa.amento/i }))

    expect(document.documentElement.getAttribute('data-spacing-increased')).toBe('true')
  })

  it('clicar no toggle de foco aplica data-focus-highlight', async () => {
    const user = userEvent.setup()
    renderWithProvider()

    await user.click(screen.getByRole('switch', { name: /destacar foco/i }))

    expect(document.documentElement.getAttribute('data-focus-highlight')).toBe('true')
  })

  it('clicar no toggle de movimento aplica data-extra-reduced-motion', async () => {
    const user = userEvent.setup()
    renderWithProvider()

    await user.click(screen.getByRole('switch', { name: /reduzir movimento/i }))

    expect(document.documentElement.getAttribute('data-extra-reduced-motion')).toBe('true')
  })
})

describe('TabAccessibility — card de pedido (showRequestCard)', () => {
  it('exibe o card de pedido por padrao', () => {
    renderWithProvider()
    expect(screen.getByTestId('request-feedback-card-mock')).toBeTruthy()
  })

  it('oculta o card de pedido quando showRequestCard=false', () => {
    renderWithProvider({}, { showRequestCard: false })
    expect(screen.queryByTestId('request-feedback-card-mock')).toBeNull()
  })
})

describe('TabAccessibility — status indicator', () => {
  it('exibe "Salvando..." durante o PATCH', async () => {
    let resolveFetch!: (v: Response) => void
    vi.spyOn(global, 'fetch').mockReturnValueOnce(new Promise<Response>((res) => { resolveFetch = res }))
    const user = userEvent.setup()
    renderWithProvider()

    await user.click(screen.getByRole('radio', { name: /^grande$/i }))
    expect(screen.getByText(/salvando/i)).toBeTruthy()

    await act(async () => {
      resolveFetch({ ok: true, json: async () => ({}) } as Response)
      await Promise.resolve()
    })
  })

  it('exibe "Salvo" apos PATCH bem-sucedido', async () => {
    const user = userEvent.setup()
    renderWithProvider()

    await act(async () => {
      await user.click(screen.getByRole('radio', { name: /^grande$/i }))
    })

    expect(screen.getByText(/^salvo$/i)).toBeTruthy()
  })

  it('exibe mensagem de erro quando PATCH falha', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('network'))
    const user = userEvent.setup()
    renderWithProvider()

    await act(async () => {
      await user.click(screen.getByRole('radio', { name: /^grande$/i }))
    })

    expect(screen.getByText(/n.o foi poss.vel salvar/i)).toBeTruthy()
  })
})
