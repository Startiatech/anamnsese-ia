// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetServerUser, mockRedirect } = vi.hoisted(() => ({
  mockGetServerUser: vi.fn(),
  mockRedirect: vi.fn(),
}))

vi.mock('@/server/services/session', () => ({ getServerUser: mockGetServerUser }))
vi.mock('next/navigation', () => ({ redirect: mockRedirect }))
vi.mock('./settings-client', () => ({ SettingsClient: () => null }))

import SettingsPage from './page'

describe('console/settings/page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('redireciona para login quando não há sessão', async () => {
    mockGetServerUser.mockResolvedValue(null)
    mockRedirect.mockImplementation(() => { throw new Error('REDIRECT') })

    await expect(SettingsPage()).rejects.toThrow('REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('redireciona para console quando role não é master', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', name: 'Admin', role: 'admin' })
    mockRedirect.mockImplementation(() => { throw new Error('REDIRECT') })

    await expect(SettingsPage()).rejects.toThrow('REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/console')
  })

  it('renderiza SettingsClient com dados do JWT para master', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', name: 'Master', role: 'master' })

    await SettingsPage()

    expect(mockRedirect).not.toHaveBeenCalled()
  })
})
