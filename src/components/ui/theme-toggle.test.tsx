import { describe, it, expect, beforeAll, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from 'next-themes'
import { ThemeToggle } from './theme-toggle'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

function renderToggle(props?: { showLabel?: boolean }) {
  return render(
    <ThemeProvider attribute="class" defaultTheme="dark">
      <ThemeToggle {...props} />
    </ThemeProvider>
  )
}

describe('ThemeToggle', () => {
  it('nao usa atributo title (substituido por tooltip)', () => {
    renderToggle()
    const button = screen.getByRole('button')
    expect(button.hasAttribute('title')).toBe(false)
  })

  it('exibe tooltip ao focar o botao', async () => {
    renderToggle()
    fireEvent.focus(screen.getByRole('button'))
    const tooltips = await screen.findAllByText(/tema (claro|escuro)/i)
    expect(tooltips.length).toBeGreaterThan(0)
  })

  it('mantem aria-label acessivel', () => {
    renderToggle()
    expect(screen.getByRole('button').getAttribute('aria-label')).toMatch(/tema (claro|escuro)/i)
  })

  it('modo icone tem alvo de toque >= 40px', () => {
    renderToggle()
    const button = screen.getByRole('button')
    expect(button.className).toContain('h-10')
    expect(button.className).toContain('w-10')
  })

  it('com showLabel nao envolve em tooltip e mostra texto inline', () => {
    renderToggle({ showLabel: true })
    expect(screen.getByText(/tema (claro|escuro)/i)).toBeTruthy()
  })
})
