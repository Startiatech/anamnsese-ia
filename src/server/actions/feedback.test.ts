// src/server/actions/feedback.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetServerUser, mockSave, mockUpdateActionTaken, mockHasAnyForUser, mockSupabaseUpdate } = vi.hoisted(() => ({
  mockGetServerUser: vi.fn(),
  mockSave: vi.fn(),
  mockUpdateActionTaken: vi.fn(),
  mockHasAnyForUser: vi.fn(),
  mockSupabaseUpdate: vi.fn(),
}))

vi.mock('@/server/services/session', () => ({
  getServerUser: mockGetServerUser,
}))

vi.mock('@/server/repositories/feedbacks', () => ({
  FeedbackRepository: {
    save: mockSave,
    updateActionTaken: mockUpdateActionTaken,
    hasAnyForUser: mockHasAnyForUser,
  },
}))

vi.mock('@/server/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: mockSupabaseUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })),
  },
}))

import { saveFeedback, scheduleAccountDeletion, cancelAccountDeletion, markFeedbackUpgrade } from './feedback'

describe('saveFeedback', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna erro quando nao autenticado', async () => {
    mockGetServerUser.mockResolvedValue(null)
    const result = await saveFeedback({ rating: 5, message: '' })
    expect(result).toEqual({ error: 'Unauthorized' })
  })

  it('salva feedback e retorna feedbackId', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', planId: 'experimental' })
    mockSave.mockResolvedValue('fb-1')
    const result = await saveFeedback({ rating: 4, message: 'Bom sistema' })
    expect(result).toEqual({ feedbackId: 'fb-1' })
    expect(mockSave).toHaveBeenCalledWith({
      userId: 'u1',
      rating: 4,
      message: 'Bom sistema',
      planId: 'experimental',
      actionTaken: 'pending',
    })
  })
})

describe('scheduleAccountDeletion', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna erro quando nao autenticado', async () => {
    mockGetServerUser.mockResolvedValue(null)
    const result = await scheduleAccountDeletion('fb-1')
    expect(result).toEqual({ error: 'Unauthorized' })
  })

  it('agenda exclusao e atualiza action_taken', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1' })
    mockUpdateActionTaken.mockResolvedValue(undefined)

    const result = await scheduleAccountDeletion('fb-1')
    expect(result).toEqual({ ok: true })
    expect(mockUpdateActionTaken).toHaveBeenCalledWith('fb-1', 'declined')
    expect(mockSupabaseUpdate).toHaveBeenCalled()
  })
})

describe('cancelAccountDeletion', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna erro quando nao autenticado', async () => {
    mockGetServerUser.mockResolvedValue(null)
    const result = await cancelAccountDeletion()
    expect(result).toEqual({ error: 'Unauthorized' })
  })

  it('limpa deletion_scheduled_at', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1' })
    const result = await cancelAccountDeletion()
    expect(result).toEqual({ ok: true })
    expect(mockSupabaseUpdate).toHaveBeenCalledWith({ deletion_scheduled_at: null })
  })
})

describe('markFeedbackUpgrade', () => {
  beforeEach(() => vi.clearAllMocks())

  it('chama updateActionTaken com upgrade_modal', async () => {
    mockUpdateActionTaken.mockResolvedValue(undefined)
    await markFeedbackUpgrade('fb-1', 'upgrade_modal')
    expect(mockUpdateActionTaken).toHaveBeenCalledWith('fb-1', 'upgrade_modal')
  })

  it('chama updateActionTaken com upgrade_organic', async () => {
    mockUpdateActionTaken.mockResolvedValue(undefined)
    await markFeedbackUpgrade('fb-1', 'upgrade_organic')
    expect(mockUpdateActionTaken).toHaveBeenCalledWith('fb-1', 'upgrade_organic')
  })

  it('nao chama updateActionTaken quando feedbackId vazio', async () => {
    await markFeedbackUpgrade('', 'upgrade_modal')
    expect(mockUpdateActionTaken).not.toHaveBeenCalled()
  })
})
