import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSingle, mockUpdate, mockSelect, mockEq, mockRpc } = vi.hoisted(() => ({
  mockSingle: vi.fn(),
  mockUpdate: vi.fn(),
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockRpc: vi.fn(),
}))

vi.mock('@/server/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect.mockReturnThis(),
      update: mockUpdate.mockReturnThis(),
      eq: mockEq.mockReturnThis(),
      single: mockSingle,
    })),
    rpc: mockRpc,
  },
}))

import { CreditRepository } from './credits'

beforeEach(() => vi.clearAllMocks())

describe('CreditRepository.getCredits', () => {
  it('returns credits_remaining from users table', async () => {
    mockSingle.mockResolvedValueOnce({ data: { credits_remaining: 42 }, error: null })
    expect(await CreditRepository.getCredits('user-1')).toBe(42)
  })

  it('returns 0 when no data', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null })
    expect(await CreditRepository.getCredits('user-1')).toBe(0)
  })
})

describe('CreditRepository.setCredits', () => {
  it('updates credits_remaining on users table', async () => {
    mockEq.mockResolvedValueOnce({ error: null })
    await CreditRepository.setCredits('user-1', 30)
    expect(mockUpdate).toHaveBeenCalledWith({ credits_remaining: 30 })
  })

  it('clamps negative values to 0', async () => {
    mockEq.mockResolvedValueOnce({ error: null })
    await CreditRepository.setCredits('user-1', -5)
    expect(mockUpdate).toHaveBeenCalledWith({ credits_remaining: 0 })
  })
})

describe('CreditRepository.debitCredit', () => {
  it('calls debit_user_credit RPC', async () => {
    mockRpc.mockResolvedValueOnce({ error: null })
    await CreditRepository.debitCredit('user-1')
    expect(mockRpc).toHaveBeenCalledWith('debit_user_credit', { p_user_id: 'user-1' })
  })
})
