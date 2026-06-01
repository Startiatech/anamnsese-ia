// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetServerUser, mockUpsert, mockRpc, mockSingle } = vi.hoisted(() => ({
  mockGetServerUser: vi.fn(),
  mockUpsert: vi.fn(),
  mockRpc: vi.fn(),
  mockSingle: vi.fn(),
}))

const { mockDebitReturningSource, mockGetCredits, mockRefundCredit } = vi.hoisted(() => ({
  mockDebitReturningSource: vi.fn(),
  mockGetCredits: vi.fn(),
  mockRefundCredit: vi.fn(),
}))

vi.mock('@/server/repositories/credits', () => ({
  CreditRepository: {
    getCredits: mockGetCredits,
    debitCreditReturningSource: mockDebitReturningSource,
    refundCredit: mockRefundCredit,
  },
}))

vi.mock('@/server/services/session', () => ({ getServerUser: mockGetServerUser }))

// Build a self-referential deep chain. Every chainable method returns `chain` itself,
// so callers can chain .eq().eq().order().limit().single() at any depth.
// We store it in a `let` so we can re-wire after vi.clearAllMocks().
let chain: {
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  neq?: ReturnType<typeof vi.fn>
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
  reconcileOrphanConsultations,
} from './consultation'

// Re-build chain after every clearAllMocks so return values are restored
beforeEach(() => {
  buildChain()
})

describe('abandonConsultation', () => {
  // A decisão de devolver crédito é tomada SOMENTE pelo banco (fonte de verdade):
  // devolve sse debit_source != null E audio_attempts === 0. Não depende de nenhum
  // booleano do cliente — sobrevive a F5, queda de rede e fechamento de aba.
  beforeEach(() => {
    vi.clearAllMocks()
    buildChain()
    mockGetServerUser.mockResolvedValue({ sub: 'user-1' })
    mockSingle.mockResolvedValue({ data: { debit_source: 'paid', audio_attempts: 0, structured_anamnesis: { sections: [] } }, error: null })
    mockUpsert.mockResolvedValue({})
    mockRefundCredit.mockResolvedValue(undefined)
  })

  it('does nothing when unauthenticated', async () => {
    mockGetServerUser.mockResolvedValue(null)
    await abandonConsultation('patient-1', 3)
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it('sets raw_transcript to null always', async () => {
    mockSingle.mockResolvedValueOnce({ data: { debit_source: 'paid', audio_attempts: 2 }, error: null })
    await abandonConsultation('patient-1', 3)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ raw_transcript: null }),
      expect.anything()
    )
  })

  it('upserts status abandoned with current_step and raw_transcript null', async () => {
    await abandonConsultation('patient-1', 3)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        patient_id: 'patient-1',
        status: 'abandoned',
        current_step: 3,
        raw_transcript: null,
      }),
      expect.objectContaining({ onConflict: 'user_id,patient_id' }),
    )
  })

  it('NÃO inclui structured_anamnesis no upsert (abandonar não apaga a anamnese anterior)', async () => {
    await abandonConsultation('patient-1', 3)
    const payload = mockUpsert.mock.calls[0][0] as Record<string, unknown>
    expect('structured_anamnesis' in payload).toBe(false)
  })

  it('refunds bonus wallet when debit_source is bonus and no AI was used (audio_attempts 0)', async () => {
    mockSingle.mockResolvedValueOnce({ data: { debit_source: 'bonus', audio_attempts: 0 }, error: null })
    await abandonConsultation('patient-1', 3)
    expect(mockRefundCredit).toHaveBeenCalledWith('user-1', 'bonus')
  })

  it('refunds paid wallet when debit_source is paid and no AI was used (audio_attempts 0)', async () => {
    mockSingle.mockResolvedValueOnce({ data: { debit_source: 'paid', audio_attempts: 0 }, error: null })
    await abandonConsultation('patient-1', 3)
    expect(mockRefundCredit).toHaveBeenCalledWith('user-1', 'paid')
  })

  it('does NOT refund when AI was used (audio_attempts > 0), mesmo após F5', async () => {
    mockSingle.mockResolvedValueOnce({ data: { debit_source: 'paid', audio_attempts: 1 }, error: null })
    await abandonConsultation('patient-1', 3)
    expect(mockRefundCredit).not.toHaveBeenCalled()
  })

  it('does NOT refund when no consultation row exists (source is null)', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null })
    await abandonConsultation('patient-1', 3)
    expect(mockRefundCredit).not.toHaveBeenCalled()
  })

  it('volta status para completed quando já havia anamnese anterior (preserva histórico)', async () => {
    mockSingle.mockResolvedValueOnce({ data: { debit_source: 'paid', audio_attempts: 0, structured_anamnesis: { sections: [{ title: 'HDA', content: 'x' }] } }, error: null })
    await abandonConsultation('patient-1', 3)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' }),
      expect.anything(),
    )
    expect(mockRefundCredit).toHaveBeenCalledWith('user-1', 'paid')
  })

  it('NÃO carimba created_at/updated_at ao voltar para completed (preserva a data real do atendimento)', async () => {
    mockSingle.mockResolvedValueOnce({ data: { debit_source: null, audio_attempts: 1, structured_anamnesis: { sections: [{ title: 'HDA', content: 'x' }] } }, error: null })
    await abandonConsultation('patient-1', 3)
    const payload = mockUpsert.mock.calls[0][0] as Record<string, unknown>
    expect(payload.status).toBe('completed')
    expect('created_at' in payload).toBe(false)
    expect('updated_at' in payload).toBe(false)
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
    mockGetCredits.mockResolvedValue(5)
    mockDebitReturningSource.mockResolvedValue('bonus')
    mockUpsert.mockResolvedValue({ error: null })
  })

  it('returns error when unauthenticated', async () => {
    mockGetServerUser.mockResolvedValue(null)
    const result = await debitConsultationCredit('patient-1')
    expect(result).toEqual({ error: 'Não autenticado' })
    expect(mockGetCredits).not.toHaveBeenCalled()
  })

  it('returns error when getCredits returns 0', async () => {
    mockGetCredits.mockResolvedValue(0)
    const result = await debitConsultationCredit('patient-1')
    expect(result).toEqual({ error: 'Créditos insuficientes' })
    expect(mockDebitReturningSource).not.toHaveBeenCalled()
  })

  it('returns error when debitCreditReturningSource returns null', async () => {
    mockDebitReturningSource.mockResolvedValue(null)
    const result = await debitConsultationCredit('patient-1')
    expect(result).toEqual({ error: 'Falha ao debitar crédito' })
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it('persists debit_source from CreditRepository into consultations upsert', async () => {
    mockDebitReturningSource.mockResolvedValue('bonus')
    await debitConsultationCredit('patient-1')
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ debit_source: 'bonus' }),
      expect.anything(),
    )
  })

  it('persists debit_source paid when source is paid', async () => {
    mockDebitReturningSource.mockResolvedValue('paid')
    await debitConsultationCredit('patient-1')
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ debit_source: 'paid' }),
      expect.anything(),
    )
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

  it('NÃO grava created_at no upsert (iniciar não define a data do atendimento — pode ser abandonado; a data é carimbada só na geração da anamnese)', async () => {
    await debitConsultationCredit('patient-1')
    const call = mockUpsert.mock.calls[0][0] as Record<string, unknown>
    expect('created_at' in call).toBe(false)
  })

  it('returns empty object on success', async () => {
    const result = await debitConsultationCredit('patient-1')
    expect(result).toEqual({})
  })

  it('NÃO inclui structured_anamnesis no upsert (iniciar atendimento preserva a anamnese anterior)', async () => {
    await debitConsultationCredit('patient-1')
    const payload = mockUpsert.mock.calls[0][0] as Record<string, unknown>
    expect('structured_anamnesis' in payload).toBe(false)
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

describe('reconcileOrphanConsultations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    buildChain()
    mockGetServerUser.mockResolvedValue({ sub: 'user-1' })
    mockRefundCredit.mockResolvedValue(undefined)
    mockUpsert.mockResolvedValue({})
  })

  it('não faz nada quando não autenticado', async () => {
    mockGetServerUser.mockResolvedValue(null)
    await reconcileOrphanConsultations('patient-keep')
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it('resolve e devolve cada órfão sem IA, exceto o paciente atual', async () => {
    chain.neq = vi.fn().mockResolvedValue({
      data: [
        { patient_id: 'p-a', debit_source: 'paid', audio_attempts: 0, structured_anamnesis: { sections: [] } },
        { patient_id: 'p-b', debit_source: 'bonus', audio_attempts: 0, structured_anamnesis: { sections: [{ title: 'HDA', content: 'x' }] } },
      ],
      error: null,
    })

    await reconcileOrphanConsultations('patient-keep')

    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ patient_id: 'p-a', status: 'abandoned' }), expect.anything())
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ patient_id: 'p-b', status: 'completed' }), expect.anything())
    expect(mockRefundCredit).toHaveBeenCalledWith('user-1', 'paid')
    expect(mockRefundCredit).toHaveBeenCalledWith('user-1', 'bonus')
  })

  it('não devolve nada quando não há órfãos', async () => {
    chain.neq = vi.fn().mockResolvedValue({ data: [], error: null })
    await reconcileOrphanConsultations('patient-keep')
    expect(mockRefundCredit).not.toHaveBeenCalled()
  })
})
