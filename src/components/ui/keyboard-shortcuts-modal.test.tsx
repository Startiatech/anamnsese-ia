import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { KeyboardShortcutsProvider } from './keyboard-shortcuts-modal'

beforeEach(() => {
  // Reset DOM
  document.body.innerHTML = ''
})

afterEach(() => vi.restoreAllMocks())

describe('KeyboardShortcutsProvider', () => {
  it('abre o modal ao pressionar shift+/', () => {
    render(
      <KeyboardShortcutsProvider>
        <main>conteudo</main>
      </KeyboardShortcutsProvider>
    )

    expect(screen.queryByRole('dialog')).toBeNull()

    act(() => {
      fireEvent.keyDown(window, { key: '?', shiftKey: true })
    })

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText(/atalhos de teclado/i)).toBeTruthy()
  })

  it('lista os atalhos esperados', () => {
    render(
      <KeyboardShortcutsProvider>
        <main>conteudo</main>
      </KeyboardShortcutsProvider>
    )

    act(() => {
      fireEvent.keyDown(window, { key: '?', shiftKey: true })
    })

    expect(screen.getByText(/^abrir esta ajuda$/i)).toBeTruthy()
    expect(screen.getByText(/fechar di.logo/i)).toBeTruthy()
  })

  it('fecha o modal ao pressionar Esc', () => {
    render(
      <KeyboardShortcutsProvider>
        <main>conteudo</main>
      </KeyboardShortcutsProvider>
    )

    act(() => {
      fireEvent.keyDown(window, { key: '?', shiftKey: true })
    })
    expect(screen.getByRole('dialog')).toBeTruthy()

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('NAO abre quando o foco esta dentro de um <input>', () => {
    render(
      <KeyboardShortcutsProvider>
        <input data-testid="some-input" />
      </KeyboardShortcutsProvider>
    )

    const input = screen.getByTestId('some-input')
    input.focus()

    act(() => {
      fireEvent.keyDown(input, { key: '?', shiftKey: true, bubbles: true })
    })

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('NAO abre quando o foco esta dentro de um <textarea>', () => {
    render(
      <KeyboardShortcutsProvider>
        <textarea data-testid="some-textarea" />
      </KeyboardShortcutsProvider>
    )

    const ta = screen.getByTestId('some-textarea')
    ta.focus()

    act(() => {
      fireEvent.keyDown(ta, { key: '?', shiftKey: true, bubbles: true })
    })

    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
