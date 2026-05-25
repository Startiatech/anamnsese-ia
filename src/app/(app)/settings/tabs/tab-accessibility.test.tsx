import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TabAccessibility } from './tab-accessibility'
import { AccessibilityProvider } from '@/context/accessibility-context'

function renderWithProvider(initialFontSize: 'normal' | 'large' | 'xlarge' = 'normal', initialHighContrast = false) {
  return render(
    <AccessibilityProvider initialFontSize={initialFontSize} initialHighContrast={initialHighContrast}>
      <TabAccessibility />
    </AccessibilityProvider>
  )
}

beforeEach(() => {
  vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ ok: true }) } as Response)
  localStorage.clear()
  document.documentElement.removeAttribute('data-font-size')
  document.documentElement.removeAttribute('data-high-contrast')
})

afterEach(() => vi.restoreAllMocks())

describe('TabAccessibility', () => {
  it('renderiza 3 opcoes de tamanho de fonte', () => {
    renderWithProvider()
    expect(screen.getByRole('radio', { name: /normal/i })).toBeTruthy()
    expect(screen.getByRole('radio', { name: /^grande$/i })).toBeTruthy()
    expect(screen.getByRole('radio', { name: /extra grande/i })).toBeTruthy()
  })

  it('marca a opcao de fonte atual como selecionada', () => {
    renderWithProvider('large')
    const grande = screen.getByRole('radio', { name: /^grande$/i }) as HTMLInputElement
    expect(grande.checked).toBe(true)
  })

  it('selecionar "Extra grande" muda o data-font-size no <html>', async () => {
    const user = userEvent.setup()
    renderWithProvider('normal')

    await user.click(screen.getByRole('radio', { name: /extra grande/i }))

    expect(document.documentElement.getAttribute('data-font-size')).toBe('xlarge')
  })

  it('renderiza toggle de alto contraste refletindo o estado atual', () => {
    renderWithProvider('normal', true)
    const toggle = screen.getByRole('switch', { name: /alto contraste/i }) as HTMLInputElement
    expect(toggle.getAttribute('aria-checked')).toBe('true')
  })

  it('clicar no toggle de alto contraste muda data-high-contrast', async () => {
    const user = userEvent.setup()
    renderWithProvider('normal', false)

    await user.click(screen.getByRole('switch', { name: /alto contraste/i }))

    expect(document.documentElement.getAttribute('data-high-contrast')).toBe('true')
  })

  it('mudancas disparam PATCH no servidor', async () => {
    const user = userEvent.setup()
    renderWithProvider('normal', false)

    await user.click(screen.getByRole('radio', { name: /^grande$/i }))

    expect(global.fetch).toHaveBeenCalledWith('/api/users/me', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ prefFontSize: 'large' }),
    }))
  })
})
