// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockInsert,
  mockSelect,
  mockEq,
  mockNeq,
  mockIs,
  mockSingle,
  mockOrder,
  mockRpc,
} = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockNeq: vi.fn(),
  mockIs: vi.fn(),
  mockSingle: vi.fn(),
  mockOrder: vi.fn(),
  mockRpc: vi.fn(),
}))

vi.mock('@/server/supabase', () => {
  const chain: Record<string, unknown> = {}
  chain.insert = (...args: unknown[]) => { mockInsert(...args); return chain }
  chain.select = (...args: unknown[]) => { mockSelect(...args); return chain }
  chain.eq = (...args: unknown[]) => { mockEq(...args); return chain }
  chain.neq = (...args: unknown[]) => { mockNeq(...args); return chain }
  chain.is = mockIs
  chain.order = (...args: unknown[]) => { mockOrder(...args); return chain }
  chain.single = mockSingle
  return {
    supabase: {
      from: vi.fn(() => chain),
      rpc: mockRpc,
    },
  }
})

import {
  logApiUsage,
  getTotalCostUsd,
  getCostByUser,
  getAllUsersCostSummary,
  getCostByPatient,
  getCostSummary,
  getProfessionalsCount,
  getActiveUsersCount,
} from './usage'

describe('logApiUsage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('insere registro com campos corretos para LLM', async () => {
    mockInsert.mockResolvedValue({ error: null })

    await logApiUsage({
      userId: 'u1',
      patientId: 'p1',
      endpoint: 'anamnesis',
      model: 'llama-3.3-70b-versatile',
      tokensInput: 800,
      tokensOutput: 400,
      costUsd: 0.000788,
    })

    expect(mockInsert).toHaveBeenCalledWith({
      user_id: 'u1',
      patient_id: 'p1',
      endpoint: 'anamnesis',
      model: 'llama-3.3-70b-versatile',
      tokens_input: 800,
      tokens_output: 400,
      audio_seconds: null,
      cost_usd: 0.000788,
    })
  })

  it('insere registro com audio_seconds para transcrição', async () => {
    mockInsert.mockResolvedValue({ error: null })

    await logApiUsage({
      userId: 'u1',
      patientId: 'p1',
      endpoint: 'transcription',
      model: 'whisper-large-v3',
      audioSeconds: 120,
      costUsd: 0.003700,
    })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'transcription',
        audio_seconds: 120,
        tokens_input: null,
        tokens_output: null,
      }),
    )
  })

  it('não lança erro se insert falhar — falha silenciosa', async () => {
    mockInsert.mockResolvedValue({ error: { message: 'DB error' } })

    await expect(
      logApiUsage({
        userId: 'u1',
        patientId: null,
        endpoint: 'refine',
        model: 'llama-3.3-70b-versatile',
        tokensInput: 100,
        tokensOutput: 50,
        costUsd: 0.0001,
      }),
    ).resolves.toBeUndefined()
  })
})

describe('getTotalCostUsd', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna soma total via rpc', async () => {
    mockRpc.mockResolvedValue({ data: 1.234567, error: null })

    const total = await getTotalCostUsd()

    expect(mockRpc).toHaveBeenCalledWith('get_total_groq_cost')
    expect(total).toBe(1.234567)
  })

  it('retorna 0 se rpc falhar', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'error' } })

    const total = await getTotalCostUsd()
    expect(total).toBe(0)
  })
})

describe('getCostByUser', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna custo total e breakdown por endpoint do usuário', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { endpoint: 'transcription', total_cost: 0.004, call_count: 2 },
        { endpoint: 'anamnesis', total_cost: 0.018, call_count: 2 },
        { endpoint: 'refine', total_cost: 0.005, call_count: 1 },
      ],
      error: null,
    })

    const result = await getCostByUser('u1')

    expect(mockRpc).toHaveBeenCalledWith('get_groq_cost_by_user', { p_user_id: 'u1' })
    expect(result.total).toBeCloseTo(0.027)
    expect(result.breakdown).toHaveLength(3)
    expect(result.breakdown[0]).toEqual({ endpoint: 'transcription', totalCost: 0.004, callCount: 2 })
  })

  it('retorna zeros se usuário não tiver uso', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })

    const result = await getCostByUser('u1')
    expect(result.total).toBe(0)
    expect(result.breakdown).toHaveLength(0)
  })
})

describe('getAllUsersCostSummary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna custo total por usuário', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { user_id: 'u1', total_cost: 0.05 },
        { user_id: 'u2', total_cost: 0.02 },
      ],
      error: null,
    })

    const summary = await getAllUsersCostSummary()

    expect(mockRpc).toHaveBeenCalledWith('get_all_users_groq_cost')
    expect(summary).toEqual({ u1: 0.05, u2: 0.02 })
  })

  it('retorna objeto vazio se não houver dados', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'error' } })

    const summary = await getAllUsersCostSummary()
    expect(summary).toEqual({})
  })
})

describe('getCostSummary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna custo por período (day, week, month, total)', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { period: 'day',   cost: 0.001 },
        { period: 'week',  cost: 0.005 },
        { period: 'month', cost: 0.012 },
        { period: 'total', cost: 0.020 },
      ],
      error: null,
    })

    const result = await getCostSummary()

    expect(mockRpc).toHaveBeenCalledWith('get_groq_cost_summary')
    expect(result).toEqual({ day: 0.001, week: 0.005, month: 0.012, total: 0.020 })
  })

  it('retorna zeros se rpc falhar', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'error' } })

    const result = await getCostSummary()
    expect(result).toEqual({ day: 0, week: 0, month: 0, total: 0 })
  })
})

describe('getProfessionalsCount', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna contagem de profissionais ativos', async () => {
    mockRpc.mockResolvedValue({ data: 7, error: null })

    const count = await getProfessionalsCount()

    expect(mockRpc).toHaveBeenCalledWith('get_professionals_count')
    expect(count).toBe(7)
  })

  it('retorna 0 se rpc falhar', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'error' } })

    const count = await getProfessionalsCount()
    expect(count).toBe(0)
  })
})

describe('getActiveUsersCount', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna contagem de usuários ativos excluindo master', async () => {
    mockIs.mockResolvedValue({ count: 2, error: null })

    const count = await getActiveUsersCount()

    expect(mockNeq).toHaveBeenCalledWith('role', 'master')
    expect(mockEq).toHaveBeenCalledWith('blocked', false)
    expect(mockIs).toHaveBeenCalledWith('deletion_scheduled_at', null)
    expect(count).toBe(2)
  })

  it('retorna 0 se query falhar', async () => {
    mockIs.mockResolvedValue({ count: null, error: { message: 'error' } })

    const count = await getActiveUsersCount()
    expect(count).toBe(0)
  })

  it('retorna 0 se count for null sem erro', async () => {
    mockIs.mockResolvedValue({ count: null, error: null })

    const count = await getActiveUsersCount()
    expect(count).toBe(0)
  })
})

describe('getCostByPatient', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna breakdown de custo por endpoint para o paciente', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { endpoint: 'transcription', total_cost: 0.003, call_count: 1 },
        { endpoint: 'anamnesis', total_cost: 0.014, call_count: 1 },
      ],
      error: null,
    })

    const result = await getCostByPatient('u1', 'p1')

    expect(mockRpc).toHaveBeenCalledWith('get_groq_cost_by_patient', {
      p_user_id: 'u1',
      p_patient_id: 'p1',
    })
    expect(result.total).toBeCloseTo(0.017)
    expect(result.breakdown).toHaveLength(2)
  })
})
