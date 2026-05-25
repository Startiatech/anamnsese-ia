// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetServerUser, mockList, mockCountUnread, mockMarkAsRead, mockMarkAllAsRead } = vi.hoisted(() => ({
  mockGetServerUser: vi.fn(),
  mockList: vi.fn(),
  mockCountUnread: vi.fn(),
  mockMarkAsRead: vi.fn(),
  mockMarkAllAsRead: vi.fn(),
}))

vi.mock('@/server/services/session', () => ({ getServerUser: mockGetServerUser }))
vi.mock('@/server/repositories/notifications', () => ({
  listForUser: mockList,
  countUnread: mockCountUnread,
  markAsRead: mockMarkAsRead,
  markAllAsRead: mockMarkAllAsRead,
}))

import {
  listMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from './notifications'

describe('listMyNotifications', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejeita quando nao autenticado', async () => {
    mockGetServerUser.mockResolvedValue(null)

    const result = await listMyNotifications()

    expect(result).toEqual({ ok: false, error: 'Unauthorized', items: [], unreadCount: 0 })
    expect(mockList).not.toHaveBeenCalled()
  })

  it('retorna items e contagem de nao lidos para o user autenticado', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', role: 'user' })
    mockList.mockResolvedValue([
      { id: 'n1', userId: 'u1', type: 'feature', title: 'X', body: null, actionUrl: null, actionLabel: null, readAt: null, createdAt: '2026-05-25T10:00:00Z' },
    ])
    mockCountUnread.mockResolvedValue(1)

    const result = await listMyNotifications()

    expect(mockList).toHaveBeenCalledWith('u1')
    expect(mockCountUnread).toHaveBeenCalledWith('u1')
    expect(result.ok).toBe(true)
    expect(result.items).toHaveLength(1)
    expect(result.unreadCount).toBe(1)
  })
})

describe('markNotificationAsRead', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejeita quando nao autenticado', async () => {
    mockGetServerUser.mockResolvedValue(null)

    const result = await markNotificationAsRead('n1')

    expect(result).toEqual({ ok: false, error: 'Unauthorized' })
    expect(mockMarkAsRead).not.toHaveBeenCalled()
  })

  it('chama markAsRead do repository com user + id', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', role: 'user' })
    mockMarkAsRead.mockResolvedValue(undefined)

    const result = await markNotificationAsRead('n1')

    expect(mockMarkAsRead).toHaveBeenCalledWith('u1', 'n1')
    expect(result).toEqual({ ok: true })
  })

  it('valida id como uuid-ish (nao vazio, nao gigante)', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', role: 'user' })

    const result = await markNotificationAsRead('')

    expect(result.ok).toBe(false)
    expect(mockMarkAsRead).not.toHaveBeenCalled()
  })

  it('retorna erro generico quando repository lanca', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', role: 'user' })
    mockMarkAsRead.mockRejectedValue(new Error('db down'))

    const result = await markNotificationAsRead('n1')

    expect(result).toEqual({ ok: false, error: 'Erro ao marcar como lida' })
  })
})

describe('markAllNotificationsAsRead', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejeita quando nao autenticado', async () => {
    mockGetServerUser.mockResolvedValue(null)

    const result = await markAllNotificationsAsRead()

    expect(result).toEqual({ ok: false, error: 'Unauthorized' })
    expect(mockMarkAllAsRead).not.toHaveBeenCalled()
  })

  it('chama markAllAsRead com o user id', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', role: 'user' })
    mockMarkAllAsRead.mockResolvedValue(undefined)

    const result = await markAllNotificationsAsRead()

    expect(mockMarkAllAsRead).toHaveBeenCalledWith('u1')
    expect(result).toEqual({ ok: true })
  })
})
