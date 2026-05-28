// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetServerUser, mockRedirect, mockFindById } = vi.hoisted(() => ({
  mockGetServerUser: vi.fn(),
  mockRedirect: vi.fn(),
  mockFindById: vi.fn(),
}))

vi.mock('@/server/services/session', () => ({ getServerUser: mockGetServerUser }))
vi.mock('@/server/repositories/users', () => ({ findUserById: mockFindById }))
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

  it('renderiza SettingsClient para master com usuário encontrado', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', name: 'Master', role: 'master' })
    mockFindById.mockResolvedValue({ id: 'u1', name: 'Master', email: 'master@test.com', phone: '(11) 90000-0000' })

    await SettingsPage()

    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('redireciona para login quando usuário não é encontrado', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', name: 'Master', role: 'master' })
    mockFindById.mockResolvedValue(undefined)
    mockRedirect.mockImplementation(() => { throw new Error('REDIRECT') })

    await expect(SettingsPage()).rejects.toThrow('REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })
})
