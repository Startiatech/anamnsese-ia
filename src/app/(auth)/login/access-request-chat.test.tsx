// @vitest-environment jsdom
import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn(() => null) }),
}))

import { AccessRequestChat } from './access-request-chat'

describe('AccessRequestChat', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders chat header with Assistente label', () => {
    render(<AccessRequestChat onBack={() => {}} />)
    expect(screen.getByText('Assistente')).toBeInTheDocument()
  })

  it('renders back button', () => {
    render(<AccessRequestChat onBack={() => {}} />)
    expect(screen.getByText(/já tenho acesso/i)).toBeInTheDocument()
  })
})
