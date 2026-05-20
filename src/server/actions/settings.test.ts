// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetServerUser, mockFindById, mockUpdateUser, mockCompare, mockHash } = vi.hoisted(() => ({
  mockGetServerUser: vi.fn(),
  mockFindById: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockCompare: vi.fn(),
  mockHash: vi.fn(),
}))

vi.mock('@/server/services/session', () => ({
  getServerUser: mockGetServerUser,
}))
vi.mock('@/server/repositories/users', () => ({
  findUserById: mockFindById,
  updateUser: mockUpdateUser,
}))
vi.mock('@/server/services/auth', () => ({
  comparePassword: mockCompare,
  hashPassword: mockHash,
}))

import { updateMasterProfile } from './settings'

const masterUser = { sub: 'u1', role: 'master' as const, email: 'master@test.com', name: 'Master', planId: null, specialty: null, crmType: null, crmNumber: null, crmUf: null, hasPin: false, passwordIsTemp: false }

describe('updateMasterProfile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna Forbidden quando não autenticado', async () => {
    mockGetServerUser.mockResolvedValue(null)

    const result = await updateMasterProfile({ name: 'New Name' })

    expect(result).toEqual({ ok: false, error: 'Forbidden' })
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it('retorna Forbidden quando role não é master', async () => {
    mockGetServerUser.mockResolvedValue({ ...masterUser, role: 'admin' })

    const result = await updateMasterProfile({ name: 'New Name' })

    expect(result).toEqual({ ok: false, error: 'Forbidden' })
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it('atualiza nome sem alterar senha quando campos de senha estão vazios', async () => {
    mockGetServerUser.mockResolvedValue(masterUser)
    mockUpdateUser.mockResolvedValue(undefined)

    const result = await updateMasterProfile({ name: 'New Name' })

    expect(mockUpdateUser).toHaveBeenCalledWith('u1', { name: 'New Name' })
    expect(mockHash).not.toHaveBeenCalled()
    expect(result).toEqual({ ok: true })
  })

  it('atualiza senha quando currentPassword está correto', async () => {
    mockGetServerUser.mockResolvedValue(masterUser)
    mockFindById.mockResolvedValue({ id: 'u1', name: 'Master', passwordHash: 'oldhash' })
    mockCompare.mockResolvedValue(true)
    mockHash.mockResolvedValue('newhash')
    mockUpdateUser.mockResolvedValue(undefined)

    const result = await updateMasterProfile({
      name: 'Master',
      currentPassword: 'correct',
      newPassword: 'newpass123',
      confirmPassword: 'newpass123',
    })

    expect(mockCompare).toHaveBeenCalledWith('correct', 'oldhash')
    expect(mockHash).toHaveBeenCalledWith('newpass123')
    expect(mockUpdateUser).toHaveBeenCalledWith('u1', { name: 'Master', passwordHash: 'newhash' })
    expect(result).toEqual({ ok: true })
  })

  it('rejeita quando currentPassword está errado', async () => {
    mockGetServerUser.mockResolvedValue(masterUser)
    mockFindById.mockResolvedValue({ id: 'u1', name: 'Master', passwordHash: 'oldhash' })
    mockCompare.mockResolvedValue(false)

    const result = await updateMasterProfile({
      name: 'Master',
      currentPassword: 'wrong',
      newPassword: 'newpass123',
      confirmPassword: 'newpass123',
    })

    expect(mockUpdateUser).not.toHaveBeenCalled()
    expect(result).toEqual({ ok: false, error: 'Senha atual incorreta.' })
  })

  it('rejeita quando confirmPassword não confere com newPassword', async () => {
    mockGetServerUser.mockResolvedValue(masterUser)

    const result = await updateMasterProfile({
      name: 'Master',
      currentPassword: 'correct',
      newPassword: 'newpass123',
      confirmPassword: 'diferente',
    })

    expect(mockCompare).not.toHaveBeenCalled()
    expect(result).toEqual({ ok: false, error: 'A confirmação de senha não confere.' })
  })
})
