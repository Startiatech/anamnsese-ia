import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SkipLink } from './skip-link'

describe('SkipLink', () => {
  it('aponta para #main-content por padrao', () => {
    render(<SkipLink />)
    const link = screen.getByRole('link', { name: /pular para o conte.do principal/i })
    expect(link.getAttribute('href')).toBe('#main-content')
  })

  it('aceita targetId customizado', () => {
    render(<SkipLink targetId="custom-target" />)
    const link = screen.getByRole('link', { name: /pular/i })
    expect(link.getAttribute('href')).toBe('#custom-target')
  })

  it('aceita label customizado', () => {
    render(<SkipLink label="Pular navegacao" />)
    expect(screen.getByRole('link', { name: 'Pular navegacao' })).toBeTruthy()
  })

  it('e visualmente oculto por padrao (sr-only) e visivel ao focar (focus:not-sr-only)', () => {
    render(<SkipLink />)
    const link = screen.getByRole('link', { name: /pular/i })
    expect(link.className).toContain('sr-only')
    expect(link.className).toContain('focus:not-sr-only')
  })

  it('e o primeiro elemento focavel quando renderizado primeiro na DOM', () => {
    render(
      <>
        <SkipLink />
        <button>outro botao</button>
      </>
    )
    const link = screen.getByRole('link', { name: /pular/i })
    const button = screen.getByRole('button')

    // Tab natural order: o link vem antes do botao no DOM
    expect(link.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
