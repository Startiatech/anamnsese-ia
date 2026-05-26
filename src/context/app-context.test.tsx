import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppProvider, useApp } from './app-context'

function Display() {
  const { credits } = useApp()
  return <span data-testid="credits">{credits}</span>
}

describe('AppProvider', () => {
  it('renderiza o valor inicial de credits', () => {
    render(<AppProvider initialCredits={5}><Display /></AppProvider>)
    expect(screen.getByTestId('credits')).toHaveTextContent('5')
  })

  it('atualiza credits quando initialCredits prop muda', () => {
    const { rerender } = render(
      <AppProvider initialCredits={5}><Display /></AppProvider>,
    )
    expect(screen.getByTestId('credits')).toHaveTextContent('5')

    rerender(<AppProvider initialCredits={3}><Display /></AppProvider>)
    expect(screen.getByTestId('credits')).toHaveTextContent('3')

    rerender(<AppProvider initialCredits={10}><Display /></AppProvider>)
    expect(screen.getByTestId('credits')).toHaveTextContent('10')
  })

  it('credits default para 0 quando initialCredits nao e fornecido', () => {
    render(<AppProvider><Display /></AppProvider>)
    expect(screen.getByTestId('credits')).toHaveTextContent('0')
  })
})
