// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetServerUser, mockUpsert, mockRpc, mockSingle } = vi.hoisted(() => ({
  mockGetServerUser: vi.fn(),
  mockUpsert: vi.fn(),
  mockRpc: vi.fn(),
  mockSingle: vi.fn(),
}))

vi.mock('@/server/services/session', () => ({ getServerUser: mockGetServerUser }))

// Build a self-referential deep chain. Every chainable method returns `chain` itself,
// so callers can chain .eq().eq().order().limit().single() at any depth.
// We store it in a `let` so we can re-wire after vi.clearAllMocks().
let chain: {
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  upsert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
}

function buildChain() {
  chain = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    single: mockSingle,
    upsert: mockUpsert,
    update: vi.fn(),
  }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)
  chain.limit.mockReturnValue(chain)
  chain.update.mockReturnValue(chain)
}

buildChain()

vi.mock('@/server/supabase', () => ({
  supabase: {
    from: vi.fn(() => chain),
    rpc: mockRpc,
  },
}))

import {
  abandonConsultation,
  saveTranscriptAndIncrementAttempts,
  clearTranscript,
  completeConsultation,
  debitConsultationCredit,
  saveRecordingConsent,
  getLatestConsultation,
} from './consultation'

// Re-build chain after every clearAllMocks so return values are restored
beforeEach(() => {
  buildChain()
})

describe('abandonConsultation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    buildChain()
    mockGetServerUser.mockResolvedValue({ sub: 'user-1' })
    mockSingle.mockResolvedValue({ data: { credits_remaining: 5 }, error: null })
    mockUpsert.mockResolvedValue({})
    mockRpc.mockResolvedValue({})
  })

  it('does nothing when unauthenticated', async () => {
    mockGetServerUser.mockResolvedValue(null)
    await abandonConsultation('patient-1', 3, false)
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it('sets raw_transcript to null always', async () => {
    await abandonConsultation('patient-1', 3, true)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ raw_transcript: null }),
      expect.anything()
    )
  })

  it('calls refund_user_credit when aiWasUsed is false', async () => {
    await abandonConsultation('patient-1', 3, false)
    expect(mockRpc).toHaveBeenCalledWith('refund_user_credit', { p_user_id: 'user-1' })
  })

  it('does NOT call refund_user_credit when aiWasUsed is true', async () => {
    await abandonConsultation('patient-1', 3, true)
    expect(mockRpc).not.toHaveBeenCalledWith('refund_user_credit', expect.anything())
  })
})

describe('saveTranscriptAndIncrementAttempts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    buildChain()
    mockGetServerUser.mockResolvedValue({ sub: 'user-1' })
    mockSingle.mockResolvedValue({ data: { credits_remaining: 5 }, error: null })
    mockRpc.mockResolvedValue({})
  })

  it('does nothing when unauthenticated', async () => {
    mockGetServerUser.mockResolvedValue(null)
    await saveTranscriptAndIncrementAttempts('patient-1', 'transcript')
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('calls save_transcript_and_increment RPC with correct params', async () => {
    await saveTranscriptAndIncrementAttempts('patient-1', 'texto transcrito')
    expect(mockRpc).toHaveBeenCalledWith('save_transcript_and_increment', {
      p_user_id: 'user-1',
      p_patient_id: 'patient-1',
      p_transcript: 'texto transcrito',
    })
  })
})

describe('clearTranscript', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    buildChain()
    mockGetServerUser.mockResolvedValue({ sub: 'user-1' })
    mockSingle.mockResolvedValue({ data: { credits_remaining: 5 }, error: null })
  })

  it('does nothing when unauthenticated', async () => {
    mockGetServerUser.mockResolvedValue(null)
    await clearTranscript('patient-1')
    expect(chain.update).not.toHaveBeenCalled()
  })

  it('sets raw_transcript to null', async () => {
    await clearTranscript('patient-1')
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ raw_transcript: null })
    )
  })
})

describe('saveRecordingConsent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    buildChain()
    mockGetServerUser.mockResolvedValue({ sub: 'user-1' })
  })

  it('does nothing when unauthenticated', async () => {
    mockGetServerUser.mockResolvedValue(null)
    await saveRecordingConsent('patient-1', 'consent text')
    expect(chain.update).not.toHaveBeenCalled()
  })

  it('saves consent text to consultations', async () => {
    await saveRecordingConsent('patient-1', 'Confirmo que orientei o paciente.')
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ recording_consent_text: 'Confirmo que orientei o paciente.' })
    )
  })
})

describe('debitConsultationCredit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    buildChain()
    mockGetServerUser.mockResolvedValue({ sub: 'user-1' })
    mockSingle.mockResolvedValue({ data: { credits_remaining: 5 }, error: null })
    mockRpc.mockResolvedValue({ data: null, error: null })
    mockUpsert.mockResolvedValue({ error: null })
  })

  it('returns error when unauthenticated', async () => {
    mockGetServerUser.mockResolvedValue(null)
    const result = await debitConsultationCredit('patient-1')
    expect(result).toEqual({ error: 'Não autenticado' })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('returns error when credits_remaining is 0', async () => {
    mockSingle.mockResolvedValue({ data: { credits_remaining: 0 }, error: null })
    const result = await debitConsultationCredit('patient-1')
    expect(result).toEqual({ error: 'Créditos insuficientes' })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('returns error when userData is null', async () => {
    mockSingle.mockResolvedValue({ data: null, error: null })
    const result = await debitConsultationCredit('patient-1')
    expect(result).toEqual({ error: 'Créditos insuficientes' })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('calls debit_user_credit RPC with correct user id', async () => {
    await debitConsultationCredit('patient-1')
    expect(mockRpc).toHaveBeenCalledWith('debit_user_credit', { p_user_id: 'user-1' })
  })

  it('upserts consultation with status in_progress at step 2', async () => {
    await debitConsultationCredit('patient-1')
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        patient_id: 'patient-1',
        status: 'in_progress',
        current_step: 2,
        raw_transcript: null,
      }),
      expect.objectContaining({ onConflict: 'user_id,patient_id' }),
    )
  })

  it('includes created_at in upsert so metrics reflect the new consultation date', async () => {
    const before = Date.now()
    await debitConsultationCredit('patient-1')
    const after = Date.now()
    const call = mockUpsert.mock.calls[0][0] as Record<string, unknown>
    expect(call).toHaveProperty('created_at')
    const ts = new Date(call.created_at as string).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })

  it('returns empty object on success', async () => {
    const result = await debitConsultationCredit('patient-1')
    expect(result).toEqual({})
  })
})

describe('completeConsultation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    buildChain()
    mockGetServerUser.mockResolvedValue({ sub: 'user-1' })
  })

  it('does nothing when unauthenticated', async () => {
    mockGetServerUser.mockResolvedValue(null)
    await completeConsultation('patient-1')
    expect(chain.update).not.toHaveBeenCalled()
  })

  it('updates status to completed', async () => {
    await completeConsultation('patient-1')
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' })
    )
  })

  it('filters by user_id and patient_id', async () => {
    await completeConsultation('patient-1')
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(chain.eq).toHaveBeenCalledWith('patient_id', 'patient-1')
  })

  it('sets updated_at to current timestamp', async () => {
    const before = Date.now()
    await completeConsultation('patient-1')
    const after = Date.now()
    const call = chain.update.mock.calls[0][0] as Record<string, unknown>
    const ts = new Date(call.updated_at as string).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })
})

describe('getLatestConsultation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    buildChain()
  })

  it('returns consultation when found', async () => {
    mockSingle.mockResolvedValue({
      data: {
        id: 'c1',
        structured_anamnesis: { sections: [{ title: 'HDA', content: 'dor torácica' }] },
        raw_transcript: 'texto',
        created_at: '2026-01-01',
        updated_at: '2026-01-02',
      },
      error: null,
    })
    const result = await getLatestConsultation('p1', 'u1')
    expect(result).not.toBeNull()
    expect(result?.structuredAnamnesis.sections[0].title).toBe('HDA')
  })

  it('returns null when no consultation exists', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const result = await getLatestConsultation('p1', 'u1')
    expect(result).toBeNull()
  })
})
