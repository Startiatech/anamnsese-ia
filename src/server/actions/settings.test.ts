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

    expect(mockUpdateUser).toHaveBeenCalledWith('u1', { name: 'New Name', phone: undefined })
    expect(mockHash).not.toHaveBeenCalled()
    expect(result).toEqual({ ok: true })
  })

  it('persiste o telefone junto com o nome', async () => {
    mockGetServerUser.mockResolvedValue(masterUser)
    mockUpdateUser.mockResolvedValue(undefined)

    const result = await updateMasterProfile({ name: 'New Name', phone: '(11) 98888-7777' })

    expect(mockUpdateUser).toHaveBeenCalledWith('u1', { name: 'New Name', phone: '(11) 98888-7777' })
    expect(result).toEqual({ ok: true })
  })

  it('persiste o telefone no fluxo de troca de senha', async () => {
    mockGetServerUser.mockResolvedValue(masterUser)
    mockFindById.mockResolvedValue({ id: 'u1', name: 'Master', passwordHash: 'oldhash' })
    mockCompare.mockResolvedValue(true)
    mockHash.mockResolvedValue('newhash')
    mockUpdateUser.mockResolvedValue(undefined)

    const result = await updateMasterProfile({
      name: 'Master',
      phone: '(11) 97777-6666',
      currentPassword: 'correct',
      newPassword: 'newpass123',
      confirmPassword: 'newpass123',
    })

    expect(mockUpdateUser).toHaveBeenCalledWith('u1', {
      name: 'Master',
      phone: '(11) 97777-6666',
      passwordHash: 'newhash',
    })
    expect(result).toEqual({ ok: true })
  })

  it('rejeita telefone maior que 20 caracteres', async () => {
    mockGetServerUser.mockResolvedValue(masterUser)

    const result = await updateMasterProfile({ name: 'Master', phone: '1'.repeat(21) })

    expect(mockUpdateUser).not.toHaveBeenCalled()
    expect(result.ok).toBe(false)
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
    expect(mockUpdateUser).toHaveBeenCalledWith('u1', { name: 'Master', phone: undefined, passwordHash: 'newhash' })
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

  it('rejeita nova senha com menos de 8 caracteres (defesa no servidor)', async () => {
    mockGetServerUser.mockResolvedValue(masterUser)

    const result = await updateMasterProfile({
      name: 'Master',
      currentPassword: 'correct',
      newPassword: '1234567',
      confirmPassword: '1234567',
    })

    expect(mockCompare).not.toHaveBeenCalled()
    expect(mockHash).not.toHaveBeenCalled()
    expect(mockUpdateUser).not.toHaveBeenCalled()
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/8 caracteres/i)
  })

  it('rejeita nova senha acima de 72 bytes (truncamento bcrypt)', async () => {
    mockGetServerUser.mockResolvedValue(masterUser)

    const longPassword = 'a'.repeat(73)
    const result = await updateMasterProfile({
      name: 'Master',
      currentPassword: 'correct',
      newPassword: longPassword,
      confirmPassword: longPassword,
    })

    expect(mockHash).not.toHaveBeenCalled()
    expect(mockUpdateUser).not.toHaveBeenCalled()
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/72 bytes/i)
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
    expect(result).toEqual({ ok: false, error: 'As senhas não coincidem' })
  })
})
