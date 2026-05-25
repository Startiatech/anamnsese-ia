import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccessibilityProvider, useAccessibility } from './accessibility-context'

function HookProbe() {
  const {
    fontSize, highContrast, spacingIncreased, focusHighlight, extraReducedMotion,
    saveStatus,
    setFontSize, setHighContrast, setSpacingIncreased, setFocusHighlight, setExtraReducedMotion,
  } = useAccessibility()
  return (
    <div>
      <span data-testid="font">{fontSize}</span>
      <span data-testid="contrast">{String(highContrast)}</span>
      <span data-testid="spacing">{String(spacingIncreased)}</span>
      <span data-testid="focus">{String(focusHighlight)}</span>
      <span data-testid="motion">{String(extraReducedMotion)}</span>
      <span data-testid="status">{saveStatus}</span>
      <button onClick={() => setFontSize('large')}>set-large</button>
      <button onClick={() => setFontSize('xlarge')}>set-xlarge</button>
      <button onClick={() => setHighContrast(true)}>set-contrast-on</button>
      <button onClick={() => setHighContrast(false)}>set-contrast-off</button>
      <button onClick={() => setSpacingIncreased(true)}>set-spacing-on</button>
      <button onClick={() => setFocusHighlight(true)}>set-focus-on</button>
      <button onClick={() => setExtraReducedMotion(true)}>set-motion-on</button>
    </div>
  )
}

beforeEach(() => {
  vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ ok: true }) } as Response)
  localStorage.clear()
  document.documentElement.removeAttribute('data-font-size')
  document.documentElement.removeAttribute('data-high-contrast')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AccessibilityProvider', () => {
  it('aplica data-font-size e data-high-contrast no <html> ao montar', () => {
    render(
      <AccessibilityProvider initialFontSize="large" initialHighContrast={true}>
        <HookProbe />
      </AccessibilityProvider>
    )

    expect(document.documentElement.getAttribute('data-font-size')).toBe('large')
    expect(document.documentElement.getAttribute('data-high-contrast')).toBe('true')
  })

  it('expoe valores iniciais via hook', () => {
    render(
      <AccessibilityProvider initialFontSize="xlarge" initialHighContrast={false}>
        <HookProbe />
      </AccessibilityProvider>
    )

    expect(screen.getByTestId('font').textContent).toBe('xlarge')
    expect(screen.getByTestId('contrast').textContent).toBe('false')
  })

  it('setFontSize atualiza DOM, localStorage e dispara PATCH', async () => {
    const user = userEvent.setup()
    render(
      <AccessibilityProvider initialFontSize="normal" initialHighContrast={false}>
        <HookProbe />
      </AccessibilityProvider>
    )

    await user.click(screen.getByText('set-large'))

    expect(document.documentElement.getAttribute('data-font-size')).toBe('large')
    expect(localStorage.getItem('a11y:fontSize')).toBe('large')
    expect(global.fetch).toHaveBeenCalledWith('/api/users/me', expect.objectContaining({
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefFontSize: 'large' }),
    }))
  })

  it('setHighContrast atualiza DOM, localStorage e dispara PATCH', async () => {
    const user = userEvent.setup()
    render(
      <AccessibilityProvider initialFontSize="normal" initialHighContrast={false}>
        <HookProbe />
      </AccessibilityProvider>
    )

    await user.click(screen.getByText('set-contrast-on'))

    expect(document.documentElement.getAttribute('data-high-contrast')).toBe('true')
    expect(localStorage.getItem('a11y:highContrast')).toBe('true')
    expect(global.fetch).toHaveBeenCalledWith('/api/users/me', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ prefHighContrast: true }),
    }))
  })

  it('mudanca sequencial mantem estado consistente no DOM', async () => {
    const user = userEvent.setup()
    render(
      <AccessibilityProvider initialFontSize="normal" initialHighContrast={false}>
        <HookProbe />
      </AccessibilityProvider>
    )

    await user.click(screen.getByText('set-xlarge'))
    await user.click(screen.getByText('set-contrast-on'))

    expect(document.documentElement.getAttribute('data-font-size')).toBe('xlarge')
    expect(document.documentElement.getAttribute('data-high-contrast')).toBe('true')
  })

  it('limpa data-high-contrast quando setHighContrast(false)', async () => {
    const user = userEvent.setup()
    render(
      <AccessibilityProvider initialFontSize="normal" initialHighContrast={true}>
        <HookProbe />
      </AccessibilityProvider>
    )

    expect(document.documentElement.getAttribute('data-high-contrast')).toBe('true')

    await user.click(screen.getByText('set-contrast-off'))

    expect(document.documentElement.getAttribute('data-high-contrast')).toBe('false')
  })

  it('useAccessibility fora do provider lanca erro', () => {
    // Silencia error boundary do React em testes
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<HookProbe />)).toThrow(/AccessibilityProvider/)
    spy.mockRestore()
  })

  it('falha silenciosa quando fetch retorna erro — DOM mantem mudanca local', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('network down'))
    const user = userEvent.setup()
    render(
      <AccessibilityProvider initialFontSize="normal" initialHighContrast={false}>
        <HookProbe />
      </AccessibilityProvider>
    )

    await act(async () => {
      await user.click(screen.getByText('set-large'))
    })

    expect(document.documentElement.getAttribute('data-font-size')).toBe('large')
    expect(localStorage.getItem('a11y:fontSize')).toBe('large')
  })

  // ─── Fase 3: novos toggles ──────────────────────────────────────────────

  it('setSpacingIncreased aplica data-spacing-increased no <html>, localStorage e PATCH', async () => {
    const user = userEvent.setup()
    render(
      <AccessibilityProvider initialFontSize="normal" initialHighContrast={false}>
        <HookProbe />
      </AccessibilityProvider>
    )

    await user.click(screen.getByText('set-spacing-on'))

    expect(document.documentElement.getAttribute('data-spacing-increased')).toBe('true')
    expect(localStorage.getItem('a11y:spacingIncreased')).toBe('true')
    expect(global.fetch).toHaveBeenCalledWith('/api/users/me', expect.objectContaining({
      body: JSON.stringify({ prefSpacingIncreased: true }),
    }))
  })

  it('setFocusHighlight aplica data-focus-highlight no <html> e dispara PATCH', async () => {
    const user = userEvent.setup()
    render(
      <AccessibilityProvider initialFontSize="normal" initialHighContrast={false}>
        <HookProbe />
      </AccessibilityProvider>
    )

    await user.click(screen.getByText('set-focus-on'))

    expect(document.documentElement.getAttribute('data-focus-highlight')).toBe('true')
    expect(global.fetch).toHaveBeenCalledWith('/api/users/me', expect.objectContaining({
      body: JSON.stringify({ prefFocusHighlight: true }),
    }))
  })

  it('setExtraReducedMotion aplica data-extra-reduced-motion e dispara PATCH', async () => {
    const user = userEvent.setup()
    render(
      <AccessibilityProvider initialFontSize="normal" initialHighContrast={false}>
        <HookProbe />
      </AccessibilityProvider>
    )

    await user.click(screen.getByText('set-motion-on'))

    expect(document.documentElement.getAttribute('data-extra-reduced-motion')).toBe('true')
    expect(global.fetch).toHaveBeenCalledWith('/api/users/me', expect.objectContaining({
      body: JSON.stringify({ prefExtraReducedMotion: true }),
    }))
  })

  it('expoe valores iniciais dos 3 novos toggles via hook', () => {
    render(
      <AccessibilityProvider
        initialFontSize="normal"
        initialHighContrast={false}
        initialSpacingIncreased={true}
        initialFocusHighlight={true}
        initialExtraReducedMotion={true}
      >
        <HookProbe />
      </AccessibilityProvider>
    )

    expect(screen.getByTestId('spacing').textContent).toBe('true')
    expect(screen.getByTestId('focus').textContent).toBe('true')
    expect(screen.getByTestId('motion').textContent).toBe('true')
  })

  // ─── Fase 3: status indicator ────────────────────────────────────────────

  it('saveStatus comeca em "idle"', () => {
    render(
      <AccessibilityProvider initialFontSize="normal" initialHighContrast={false}>
        <HookProbe />
      </AccessibilityProvider>
    )
    expect(screen.getByTestId('status').textContent).toBe('idle')
  })

  it('saveStatus transiciona idle -> saving -> saved apos PATCH bem-sucedido', async () => {
    let resolveFetch!: (v: Response) => void
    vi.spyOn(global, 'fetch').mockReturnValueOnce(new Promise<Response>((res) => { resolveFetch = res }))
    const user = userEvent.setup()
    render(
      <AccessibilityProvider initialFontSize="normal" initialHighContrast={false}>
        <HookProbe />
      </AccessibilityProvider>
    )

    await user.click(screen.getByText('set-large'))
    expect(screen.getByTestId('status').textContent).toBe('saving')

    await act(async () => {
      resolveFetch({ ok: true, json: async () => ({ ok: true }) } as Response)
      await Promise.resolve()
    })
    expect(screen.getByTestId('status').textContent).toBe('saved')
  })

  it('saveStatus vira "error" quando fetch falha', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('network down'))
    const user = userEvent.setup()
    render(
      <AccessibilityProvider initialFontSize="normal" initialHighContrast={false}>
        <HookProbe />
      </AccessibilityProvider>
    )

    await act(async () => {
      await user.click(screen.getByText('set-large'))
    })

    expect(screen.getByTestId('status').textContent).toBe('error')
  })
})
