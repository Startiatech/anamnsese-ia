import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LandingFooter } from './landing-footer'

describe('LandingFooter', () => {
  it('renderiza link do portfolio apontando para a URL correta', () => {
    render(<LandingFooter />)
    const link = screen.getByRole('link', { name: /portf.lio/i })
    expect(link.getAttribute('href')).toBe('https://leonardo-santos-portfolio.vercel.app/')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('posiciona o portfolio antes do LinkedIn', () => {
    render(<LandingFooter />)
    const portfolio = screen.getByRole('link', { name: /portf.lio/i })
    const linkedin = screen.getByRole('link', { name: /linkedin/i })
    expect(
      portfolio.compareDocumentPosition(linkedin) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('nao usa atributo title nos links (substituido por tooltip)', () => {
    render(<LandingFooter />)
    for (const name of [/portf.lio/i, /linkedin/i, /whatsapp/i]) {
      expect(screen.getByRole('link', { name }).hasAttribute('title')).toBe(false)
    }
  })

  it('exibe tooltip ao focar cada icone social', async () => {
    render(<LandingFooter />)
    const cases: Array<[RegExp, RegExp]> = [
      [/portf.lio/i, /portf.lio/i],
      [/linkedin/i, /linkedin/i],
      [/whatsapp/i, /whatsapp/i],
    ]
    for (const [linkName, tooltipText] of cases) {
      fireEvent.focus(screen.getByRole('link', { name: linkName }))
      const tooltips = await screen.findAllByText(tooltipText)
      expect(tooltips.length).toBeGreaterThan(0)
    }
  })

  it('mantem os links de LinkedIn e WhatsApp', () => {
    render(<LandingFooter />)
    expect(screen.getByRole('link', { name: /linkedin/i }).getAttribute('href')).toBe(
      'https://www.linkedin.com/in/leojosants/'
    )
    expect(screen.getByRole('link', { name: /whatsapp/i }).getAttribute('href')).toContain('wa.me')
  })
})
