import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TabSecurity } from './tab-security'

const { mockUpdateMasterProfile, mockToast } = vi.hoisted(() => ({
  mockUpdateMasterProfile: vi.fn(),
  mockToast: { promise: vi.fn((p: Promise<unknown>) => p) },
}))

vi.mock('@/server/actions/settings', () => ({
  updateMasterProfile: mockUpdateMasterProfile,
}))

vi.mock('sonner', () => ({ toast: mockToast }))

beforeEach(() => {
  vi.clearAllMocks()
  mockUpdateMasterProfile.mockResolvedValue({ ok: true })
})

describe('Console TabSecurity — cabeçalho do bloco', () => {
  it('exibe título e descrição do bloco de senha (padrão user)', () => {
    render(<TabSecurity userName="Master" />)

    expect(screen.getByText(/^senha$/i)).toBeTruthy()
    expect(screen.getByText(/senha forte/i)).toBeTruthy()
  })

  it('renderiza os três campos de senha', () => {
    render(<TabSecurity userName="Master" />)

    expect(screen.getByText(/^senha atual$/i)).toBeTruthy()
    expect(screen.getByText(/^nova senha$/i)).toBeTruthy()
    expect(screen.getByText(/^confirmar nova senha$/i)).toBeTruthy()
  })
})
