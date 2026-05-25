import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  single: vi.fn(),
}))

vi.mock('@/server/supabase', () => ({ supabase: mockSupabase }))

import {
  createAccessibilityRequest,
  listAllForAdmin,
  countPending,
  updateRequestStatus,
} from './accessibility-requests'

describe('createAccessibilityRequest', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('insere com user_id e message e retorna o id', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: 'req-1' },
      error: null,
    })
    mockSupabase.select.mockReturnThis()
    mockSupabase.insert.mockReturnValueOnce({
      select: () => ({ single: mockSupabase.single }),
    })

    const id = await createAccessibilityRequest('u1', 'Quero fonte para dislexia')

    expect(mockSupabase.from).toHaveBeenCalledWith('accessibility_requests')
    expect(mockSupabase.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      message: 'Quero fonte para dislexia',
    })
    expect(id).toBe('req-1')
  })

  it('lanca erro quando supabase retorna error', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'fk violation' },
    })
    mockSupabase.insert.mockReturnValueOnce({
      select: () => ({ single: mockSupabase.single }),
    })

    await expect(
      createAccessibilityRequest('u1', 'msg')
    ).rejects.toThrow(/createAccessibilityRequest failed: fk violation/)
  })
})

describe('listAllForAdmin', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('lista todos os pedidos ordenados desc por created_at, com nome/email do user', async () => {
    mockSupabase.order.mockResolvedValueOnce({
      data: [
        {
          id: 'req-1',
          user_id: 'u1',
          message: 'Pedido teste',
          status: 'pending',
          created_at: '2026-05-25T10:00:00Z',
          updated_at: '2026-05-25T10:00:00Z',
          users: { name: 'Dr. Joao', email: 'joao@x.com' },
        },
      ],
      error: null,
    })

    const result = await listAllForAdmin()

    expect(mockSupabase.from).toHaveBeenCalledWith('accessibility_requests')
    expect(mockSupabase.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(result).toEqual([
      {
        id: 'req-1',
        userId: 'u1',
        message: 'Pedido teste',
        status: 'pending',
        createdAt: '2026-05-25T10:00:00Z',
        updatedAt: '2026-05-25T10:00:00Z',
        userName: 'Dr. Joao',
        userEmail: 'joao@x.com',
      },
    ])
  })

  it('retorna array vazio quando data e null', async () => {
    mockSupabase.order.mockResolvedValueOnce({ data: null, error: null })

    const result = await listAllForAdmin()

    expect(result).toEqual([])
  })

  it('aceita user nulo (gracefully) quando join nao bate', async () => {
    mockSupabase.order.mockResolvedValueOnce({
      data: [
        { id: 'req-1', user_id: 'u1', message: 'x', status: 'pending', created_at: '2026-01-01', updated_at: '2026-01-01', users: null },
      ],
      error: null,
    })

    const result = await listAllForAdmin()

    expect(result[0].userName).toBeNull()
    expect(result[0].userEmail).toBeNull()
  })
})

describe('countPending', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('conta pedidos com status pending', async () => {
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockReturnValueOnce({ then: (cb: (v: { count: number; error: null }) => unknown) => cb({ count: 5, error: null }) }),
      }),
    } as never)

    const count = await countPending()

    expect(count).toBe(5)
  })

  it('retorna 0 quando count e null', async () => {
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockReturnValueOnce({ then: (cb: (v: { count: null; error: null }) => unknown) => cb({ count: null, error: null }) }),
      }),
    } as never)

    const count = await countPending()

    expect(count).toBe(0)
  })
})

describe('updateRequestStatus', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('seta status novo e atualiza updated_at', async () => {
    mockSupabase.update.mockReturnValueOnce({ eq: vi.fn().mockResolvedValue({ error: null }) })

    await updateRequestStatus('req-1', 'read')

    const updateCall = mockSupabase.update.mock.calls[0][0] as Record<string, unknown>
    expect(updateCall.status).toBe('read')
    expect(updateCall.updated_at).toBeTruthy()
  })

  it('lanca erro quando supabase retorna error', async () => {
    mockSupabase.update.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValue({ error: { message: 'not found' } }),
    })

    await expect(updateRequestStatus('req-1', 'archived')).rejects.toThrow(/updateRequestStatus failed: not found/)
  })
})
