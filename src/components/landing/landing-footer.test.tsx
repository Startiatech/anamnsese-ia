import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
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

  it('usa title nativo nos links (footer é server component estático — sem Radix Tooltip, evita hydration mismatch)', () => {
    render(<LandingFooter />)
    expect(screen.getByRole('link', { name: /portf.lio/i }).getAttribute('title')).toMatch(/portf.lio/i)
    expect(screen.getByRole('link', { name: /linkedin/i }).getAttribute('title')).toMatch(/linkedin/i)
    expect(screen.getByRole('link', { name: /whatsapp/i }).getAttribute('title')).toMatch(/whatsapp/i)
  })

  it('mantem os links de LinkedIn e WhatsApp', () => {
    render(<LandingFooter />)
    expect(screen.getByRole('link', { name: /linkedin/i }).getAttribute('href')).toBe(
      'https://www.linkedin.com/in/leojosants/'
    )
    expect(screen.getByRole('link', { name: /whatsapp/i }).getAttribute('href')).toContain('wa.me')
  })
})
