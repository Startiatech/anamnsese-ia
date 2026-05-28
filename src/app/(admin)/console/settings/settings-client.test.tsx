import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsClient } from './settings-client'

vi.mock('@/components/console/page-header', () => ({
  PageHeader: () => <div data-testid="page-header-mock" />,
}))

vi.mock('./tabs/tab-profile', () => ({
  TabProfile: () => <div data-testid="tab-profile-mock" />,
}))

vi.mock('./tabs/tab-security', () => ({
  TabSecurity: () => <div data-testid="tab-security-mock" />,
}))

let lastA11yProps: { showRequestCard?: boolean } = {}

vi.mock('@/app/(app)/app/settings/tabs/tab-accessibility', () => ({
  TabAccessibility: (props: { showRequestCard?: boolean }) => {
    lastA11yProps = props
    return <div data-testid="tab-accessibility-mock" />
  },
}))

beforeEach(() => {
  lastA11yProps = {}
  vi.clearAllMocks()
})

describe('Console SettingsClient — aba Acessibilidade', () => {
  it('exibe a aba Acessibilidade', () => {
    render(<SettingsClient userName="Master" />)
    expect(screen.getByRole('button', { name: /acessibilidade/i })).toBeTruthy()
  })

  it('clicar na aba renderiza o painel de acessibilidade sem o card de pedido', () => {
    render(<SettingsClient userName="Master" />)

    fireEvent.click(screen.getByRole('button', { name: /acessibilidade/i }))

    expect(screen.getByTestId('tab-accessibility-mock')).toBeTruthy()
    expect(lastA11yProps.showRequestCard).toBe(false)
  })
})
