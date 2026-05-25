import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  single: vi.fn(),
}))

vi.mock('@/server/supabase', () => ({ supabase: mockSupabase }))

import {
  listForUser,
  countUnread,
  markAsRead,
  markAllAsRead,
  createNotification,
} from './notifications'

describe('listForUser', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('busca por user_id, ordena desc por created_at, limita a 20 e mapeia para camelCase', async () => {
    mockSupabase.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'n1',
          user_id: 'u1',
          type: 'feature',
          title: 'Novidade',
          body: 'Descricao',
          action_url: '/configuracoes',
          action_label: 'Conhecer',
          read_at: null,
          created_at: '2026-05-25T10:00:00Z',
        },
      ],
      error: null,
    })

    const result = await listForUser('u1')

    expect(mockSupabase.from).toHaveBeenCalledWith('notifications')
    expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(mockSupabase.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(mockSupabase.limit).toHaveBeenCalledWith(20)
    expect(result).toEqual([
      {
        id: 'n1',
        userId: 'u1',
        type: 'feature',
        title: 'Novidade',
        body: 'Descricao',
        actionUrl: '/configuracoes',
        actionLabel: 'Conhecer',
        readAt: null,
        createdAt: '2026-05-25T10:00:00Z',
      },
    ])
  })

  it('retorna array vazio quando data e null', async () => {
    mockSupabase.limit.mockResolvedValueOnce({ data: null, error: null })

    const result = await listForUser('u1')

    expect(result).toEqual([])
  })
})

describe('countUnread', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('conta apenas notificacoes nao lidas (read_at is null) do usuario', async () => {
    const headMock = vi.fn().mockResolvedValue({ count: 3, error: null })
    mockSupabase.is.mockReturnValueOnce({ count: undefined })
    // overrides the chain — countUnread uses .select(..., { count: 'exact', head: true })
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockReturnValueOnce({
          is: vi.fn().mockReturnValueOnce({ then: (cb: (v: { count: number; error: null }) => unknown) => cb({ count: 3, error: null }) }),
        }),
      }),
    } as never)

    const count = await countUnread('u1')

    expect(count).toBe(3)
    headMock.mockClear()
  })

  it('retorna 0 quando count e null', async () => {
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockReturnValueOnce({
          is: vi.fn().mockReturnValueOnce({ then: (cb: (v: { count: null; error: null }) => unknown) => cb({ count: null, error: null }) }),
        }),
      }),
    } as never)

    const count = await countUnread('u1')

    expect(count).toBe(0)
  })
})

describe('markAsRead', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('seta read_at=now() na notificacao do user', async () => {
    const secondEq = vi.fn().mockResolvedValue({ error: null })
    const firstEq = vi.fn().mockReturnValue({ eq: secondEq })
    mockSupabase.update.mockReturnValueOnce({ eq: firstEq })

    await markAsRead('u1', 'n1')

    expect(mockSupabase.from).toHaveBeenCalledWith('notifications')
    const updateCall = mockSupabase.update.mock.calls[0][0] as Record<string, unknown>
    expect(updateCall.read_at).toBeTruthy() // ISO timestamp
    expect(firstEq).toHaveBeenCalledWith('id', 'n1')
    expect(secondEq).toHaveBeenCalledWith('user_id', 'u1')
  })

  it('lanca erro quando supabase retorna error', async () => {
    const secondEq = vi.fn().mockResolvedValue({ error: { message: 'not found' } })
    const firstEq = vi.fn().mockReturnValue({ eq: secondEq })
    mockSupabase.update.mockReturnValueOnce({ eq: firstEq })

    await expect(markAsRead('u1', 'n1')).rejects.toThrow(/markAsRead failed: not found/)
  })
})

describe('markAllAsRead', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('seta read_at=now() em todas as nao lidas do user', async () => {
    const isMock = vi.fn().mockResolvedValue({ error: null })
    const eqMock = vi.fn().mockReturnValue({ is: isMock })
    mockSupabase.update.mockReturnValueOnce({ eq: eqMock })

    await markAllAsRead('u1')

    const updateCall = mockSupabase.update.mock.calls[0][0] as Record<string, unknown>
    expect(updateCall.read_at).toBeTruthy()
    expect(eqMock).toHaveBeenCalledWith('user_id', 'u1')
    expect(isMock).toHaveBeenCalledWith('read_at', null)
  })
})

describe('createNotification', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('insere com mapeamento camelCase -> snake_case', async () => {
    mockSupabase.insert.mockResolvedValueOnce({ error: null })

    await createNotification({
      userId: 'u1',
      type: 'feature',
      title: 'Novidade',
      body: 'Descricao',
      actionUrl: '/configuracoes',
      actionLabel: 'Conhecer',
    })

    expect(mockSupabase.from).toHaveBeenCalledWith('notifications')
    expect(mockSupabase.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      type: 'feature',
      title: 'Novidade',
      body: 'Descricao',
      action_url: '/configuracoes',
      action_label: 'Conhecer',
    })
  })

  it('aceita payload minimo (sem body/actionUrl/actionLabel)', async () => {
    mockSupabase.insert.mockResolvedValueOnce({ error: null })

    await createNotification({ userId: 'u1', type: 'info', title: 'Curto' })

    expect(mockSupabase.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      type: 'info',
      title: 'Curto',
      body: null,
      action_url: null,
      action_label: null,
    })
  })

  it('lanca erro quando insert falha', async () => {
    mockSupabase.insert.mockResolvedValueOnce({ error: { message: 'fk violation' } })

    await expect(
      createNotification({ userId: 'u1', type: 'info', title: 'X' })
    ).rejects.toThrow(/createNotification failed: fk violation/)
  })
})
