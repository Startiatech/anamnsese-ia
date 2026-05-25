// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetServerUser, mockCreate, mockList, mockCountPending, mockUpdateStatus } = vi.hoisted(() => ({
  mockGetServerUser: vi.fn(),
  mockCreate: vi.fn(),
  mockList: vi.fn(),
  mockCountPending: vi.fn(),
  mockUpdateStatus: vi.fn(),
}))

vi.mock('@/server/services/session', () => ({ getServerUser: mockGetServerUser }))
vi.mock('@/server/repositories/accessibility-requests', () => ({
  createAccessibilityRequest: mockCreate,
  listAllForAdmin: mockList,
  countPending: mockCountPending,
  updateRequestStatus: mockUpdateStatus,
}))

import {
  submitAccessibilityRequest,
  listAccessibilityRequests,
  markRequestAsRead,
  archiveRequest,
} from './accessibility-requests'

describe('submitAccessibilityRequest', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejeita quando nao autenticado', async () => {
    mockGetServerUser.mockResolvedValue(null)

    const result = await submitAccessibilityRequest({ message: 'Pedido valido com mais de 10 chars' })

    expect(result).toEqual({ ok: false, error: 'Unauthorized' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('rejeita mensagem muito curta (< 10 chars)', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', role: 'user' })

    const result = await submitAccessibilityRequest({ message: 'curto' })

    expect(result.ok).toBe(false)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('rejeita mensagem muito longa (> 500 chars)', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', role: 'user' })

    const result = await submitAccessibilityRequest({ message: 'a'.repeat(501) })

    expect(result.ok).toBe(false)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('faz trim e persiste quando mensagem valida', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', role: 'user' })
    mockCreate.mockResolvedValue('req-new-id')

    const result = await submitAccessibilityRequest({ message: '   Quero fonte para dislexia   ' })

    expect(mockCreate).toHaveBeenCalledWith('u1', 'Quero fonte para dislexia')
    expect(result).toEqual({ ok: true, id: 'req-new-id' })
  })

  it('retorna erro generico quando repository lanca', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', role: 'user' })
    mockCreate.mockRejectedValue(new Error('db down'))

    const result = await submitAccessibilityRequest({ message: 'Pedido legitimo de teste' })

    expect(result).toEqual({ ok: false, error: 'Erro ao enviar pedido' })
  })
})

describe('listAccessibilityRequests (admin)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejeita quando role nao e admin nem master', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', role: 'user' })

    const result = await listAccessibilityRequests()

    expect(result.ok).toBe(false)
    expect(result.error).toBe('Forbidden')
    expect(mockList).not.toHaveBeenCalled()
  })

  it('permite admin listar', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', role: 'admin' })
    mockList.mockResolvedValue([{ id: 'r1' }])
    mockCountPending.mockResolvedValue(1)

    const result = await listAccessibilityRequests()

    expect(result.ok).toBe(true)
    expect(result.items).toHaveLength(1)
    expect(result.pendingCount).toBe(1)
  })

  it('permite master listar', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', role: 'master' })
    mockList.mockResolvedValue([])
    mockCountPending.mockResolvedValue(0)

    const result = await listAccessibilityRequests()

    expect(result.ok).toBe(true)
  })
})

describe('markRequestAsRead', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejeita quando nao e admin/master', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', role: 'user' })

    const result = await markRequestAsRead('req-1')

    expect(result).toEqual({ ok: false, error: 'Forbidden' })
    expect(mockUpdateStatus).not.toHaveBeenCalled()
  })

  it('chama updateRequestStatus(id, read) quando admin', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', role: 'admin' })
    mockUpdateStatus.mockResolvedValue(undefined)

    const result = await markRequestAsRead('req-1')

    expect(mockUpdateStatus).toHaveBeenCalledWith('req-1', 'read')
    expect(result).toEqual({ ok: true })
  })
})

describe('archiveRequest', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejeita quando nao e admin/master', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', role: 'user' })

    const result = await archiveRequest('req-1')

    expect(result).toEqual({ ok: false, error: 'Forbidden' })
  })

  it('chama updateRequestStatus(id, archived) quando admin', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', role: 'admin' })
    mockUpdateStatus.mockResolvedValue(undefined)

    const result = await archiveRequest('req-1')

    expect(mockUpdateStatus).toHaveBeenCalledWith('req-1', 'archived')
    expect(result).toEqual({ ok: true })
  })
})
