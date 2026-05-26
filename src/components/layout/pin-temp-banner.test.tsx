import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PinTempBanner } from './pin-temp-banner'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe('PinTempBanner', () => {
  it('nao renderiza quando pinIsTemp é false', () => {
    const { container } = render(<PinTempBanner pinIsTemp={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renderiza banner quando pinIsTemp é true', () => {
    render(<PinTempBanner pinIsTemp={true} />)
    expect(screen.getByText(/PIN de recuperação/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Atualizar PIN/i })).toBeInTheDocument()
  })

  it('link aponta para settings com param pin=1', () => {
    render(<PinTempBanner pinIsTemp={true} />)
    expect(screen.getByRole('link', { name: /Atualizar PIN/i })).toHaveAttribute('href', '/app/settings?pin=1')
  })
})
