import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSingle = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockInsert = vi.fn()
const mockOrder = vi.fn()
const mockLimit = vi.fn()

vi.mock('@/server/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect.mockReturnThis(),
      eq: mockEq.mockReturnThis(),
      single: mockSingle,
      insert: mockInsert.mockResolvedValue({ error: null }),
      order: mockOrder.mockReturnThis(),
      limit: mockLimit.mockReturnThis(),
      maybeSingle: mockSingle,
    })),
  },
}))

import { findRequestByEmail } from '@/server/repositories/requests'

beforeEach(() => vi.clearAllMocks())

describe('findRequestByEmail', () => {
  it('returns existing request when email found', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'req-1', email: 'dr@test.com', name: 'Dr. Ana', specialty: 'Cardiologia', phone: '5511999', message: '', status: 'pending', created_at: '2026-01-01T00:00:00Z' },
      error: null,
    })
    const result = await findRequestByEmail('dr@test.com')
    expect(result).toMatchObject({ id: 'req-1', email: 'dr@test.com', status: 'pending' })
  })

  it('returns undefined when no request found', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null })
    const result = await findRequestByEmail('new@test.com')
    expect(result).toBeUndefined()
  })
})
