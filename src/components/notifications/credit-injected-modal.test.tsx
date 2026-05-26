import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockAcknowledge, mockRefreshCredits } = vi.hoisted(() => ({
  mockAcknowledge: vi.fn(),
  mockRefreshCredits: vi.fn(),
}))

vi.mock('@/server/actions/notifications', () => ({
  acknowledgeNotification: mockAcknowledge,
}))

vi.mock('@/context/app-context', () => ({
  useApp: () => ({ refreshCredits: mockRefreshCredits }),
}))

import { CreditInjectedModal } from './credit-injected-modal'

describe('CreditInjectedModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAcknowledge.mockResolvedValue({})
  })

  it('renderiza titulo e body recebidos via props', () => {
    render(<CreditInjectedModal notificationId="n-1" title="🎁 Você recebeu 5 créditos bônus!" body="Cortesia do time." />)
    expect(screen.getByText('🎁 Você recebeu 5 créditos bônus!')).toBeInTheDocument()
    expect(screen.getByText(/cortesia do time/i)).toBeInTheDocument()
  })

  it('chama acknowledgeNotification e refreshCredits ao clicar Entendi', async () => {
    render(<CreditInjectedModal notificationId="n-1" title="t" body={null} />)
    fireEvent.click(screen.getByRole('button', { name: /entendi/i }))
    await waitFor(() => {
      expect(mockAcknowledge).toHaveBeenCalledWith('n-1')
      expect(mockRefreshCredits).toHaveBeenCalled()
    })
  })
})
