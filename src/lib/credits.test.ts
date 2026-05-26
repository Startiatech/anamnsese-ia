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
  it('returns sum of bonus and paid credits', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { credits_remaining: 42, bonus_credits: 0 },
      error: null,
    })
    expect(await CreditRepository.getCredits('user-1')).toBe(42)
  })

  it('returns sum when both bonus and paid are non-zero', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { credits_remaining: 5, bonus_credits: 3 },
      error: null,
    })
    expect(await CreditRepository.getCredits('user-1')).toBe(8)
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

describe('CreditRepository.debitCreditReturningSource', () => {
  it('returns "bonus" when RPC returns bonus', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'bonus', error: null })
    const result = await CreditRepository.debitCreditReturningSource('user-1')
    expect(mockRpc).toHaveBeenCalledWith('debit_user_credit', { p_user_id: 'user-1' })
    expect(result).toBe('bonus')
  })

  it('returns "paid" when RPC returns paid', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'paid', error: null })
    const result = await CreditRepository.debitCreditReturningSource('user-1')
    expect(result).toBe('paid')
  })

  it('returns null when RPC returns null', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null })
    const result = await CreditRepository.debitCreditReturningSource('user-1')
    expect(result).toBeNull()
  })
})

describe('CreditRepository.refundCredit', () => {
  it('calls refund_user_credit RPC with user id and source bonus', async () => {
    mockRpc.mockResolvedValueOnce({ error: null })
    await CreditRepository.refundCredit('user-1', 'bonus')
    expect(mockRpc).toHaveBeenCalledWith('refund_user_credit', {
      p_user_id: 'user-1',
      p_source: 'bonus',
    })
  })

  it('calls refund_user_credit RPC with user id and source paid', async () => {
    mockRpc.mockResolvedValueOnce({ error: null })
    await CreditRepository.refundCredit('user-1', 'paid')
    expect(mockRpc).toHaveBeenCalledWith('refund_user_credit', {
      p_user_id: 'user-1',
      p_source: 'paid',
    })
  })
})

describe('CreditRepository.addBonusCredits', () => {
  it('calls add_user_bonus_credits RPC and returns new total', async () => {
    mockRpc.mockResolvedValueOnce({ data: 15, error: null })
    const result = await CreditRepository.addBonusCredits('user-1', 10)
    expect(mockRpc).toHaveBeenCalledWith('add_user_bonus_credits', {
      p_user_id: 'user-1',
      p_amount: 10,
    })
    expect(result).toBe(15)
  })

  it('returns 0 when RPC returns null', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null })
    const result = await CreditRepository.addBonusCredits('user-1', 5)
    expect(result).toBe(0)
  })
})

describe('CreditRepository.getCreditsBreakdown', () => {
  it('returns bonus, paid and total from users table', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { credits_remaining: 10, bonus_credits: 5 },
      error: null,
    })
    const result = await CreditRepository.getCreditsBreakdown('user-1')
    expect(result).toEqual({ bonus: 5, paid: 10, total: 15 })
  })

  it('returns zeros when no data', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null })
    const result = await CreditRepository.getCreditsBreakdown('user-1')
    expect(result).toEqual({ bonus: 0, paid: 0, total: 0 })
  })
})
