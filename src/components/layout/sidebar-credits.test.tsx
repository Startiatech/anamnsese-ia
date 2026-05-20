import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SidebarCredits } from './sidebar-credits'

vi.mock('@/components/ui/sidebar', () => ({
  useSidebar: () => ({ open: true }),
}))

describe('SidebarCredits — bonusCredits', () => {
  it('does not show bonus badge when bonusCredits is 0', () => {
    render(<SidebarCredits credits={40} planQuota={50} bonusCredits={0} />)
    expect(screen.queryByText(/bônus/i)).toBeNull()
  })

  it('does not show bonus badge when bonusCredits is undefined', () => {
    render(<SidebarCredits credits={40} planQuota={50} />)
    expect(screen.queryByText(/bônus/i)).toBeNull()
  })

  it('shows bonus badge with correct count when bonusCredits > 0', () => {
    render(<SidebarCredits credits={40} planQuota={50} bonusCredits={3} />)
    expect(screen.getByText(/3 créditos bônus/i)).toBeInTheDocument()
  })
})
