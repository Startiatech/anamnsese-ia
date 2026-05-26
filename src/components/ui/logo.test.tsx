import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Logo } from './logo'

describe('Logo — wordmark anamnese_IA_', () => {
  it('renderiza o segmento base "anamnese" e o segmento colorido "_IA_"', () => {
    const { container } = render(<Logo />)
    const text = container.querySelector('svg text')
    expect(text).not.toBeNull()
    expect(text!.textContent).toBe('anamnese_IA_')

    const tspans = container.querySelectorAll('svg text tspan')
    expect(tspans).toHaveLength(2)
    expect(tspans[0].textContent).toBe('anamnese')
    expect(tspans[1].textContent).toBe('_IA_')
  })

  it('aceita prop size sem quebrar', () => {
    const { container } = render(<Logo size="sm" />)
    expect(container.querySelector('svg')).not.toBeNull()
  })
})
