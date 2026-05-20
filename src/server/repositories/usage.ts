import { supabase } from '@/server/supabase'

// ─── Groq pricing constants (USD) ────────────────────────────────────────────
// whisper-large-v3: $0.111 / hour
const WHISPER_COST_PER_SECOND = 0.111 / 3600
// llama-3.3-70b-versatile: $0.59/1M input, $0.79/1M output
const LLAMA_COST_PER_INPUT_TOKEN  = 0.59 / 1_000_000
const LLAMA_COST_PER_OUTPUT_TOKEN = 0.79 / 1_000_000

export function calcLlamaCost(tokensInput: number, tokensOutput: number): number {
  return tokensInput * LLAMA_COST_PER_INPUT_TOKEN + tokensOutput * LLAMA_COST_PER_OUTPUT_TOKEN
}

export function calcWhisperCost(audioSeconds: number): number {
  return audioSeconds * WHISPER_COST_PER_SECOND
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ApiEndpoint = 'transcription' | 'anamnesis' | 'refine'

export interface LogApiUsageInput {
  userId: string
  patientId: string | null
  endpoint: ApiEndpoint
  model: string
  tokensInput?: number
  tokensOutput?: number
  audioSeconds?: number
  costUsd: number
}

export interface EndpointBreakdown {
  endpoint: ApiEndpoint
  totalCost: number
  callCount: number
}

export interface CostResult {
  total: number
  breakdown: EndpointBreakdown[]
}

export interface CostSummary {
  day: number
  week: number
  month: number
  total: number
}

// ─── Repository ───────────────────────────────────────────────────────────────

export const UsageRepository = {
  async logApiUsage(input: LogApiUsageInput): Promise<void> {
    const { error } = await supabase.from('api_usage_log').insert({
      user_id:       input.userId,
      patient_id:    input.patientId,
      endpoint:      input.endpoint,
      model:         input.model,
      tokens_input:  input.tokensInput ?? null,
      tokens_output: input.tokensOutput ?? null,
      audio_seconds: input.audioSeconds ?? null,
      cost_usd:      input.costUsd,
    })
    if (error) {
      console.error('[UsageRepository] logApiUsage error:', error.message)
    }
  },

  async getTotalCostUsd(): Promise<number> {
    const { data, error } = await supabase.rpc('get_total_groq_cost')
    if (error || data === null) return 0
    return data as number
  },

  async getCostByUser(userId: string): Promise<CostResult> {
    const { data, error } = await supabase.rpc('get_groq_cost_by_user', { p_user_id: userId })
    if (error || !data) return { total: 0, breakdown: [] }
    const rows = data as { endpoint: string; total_cost: number; call_count: number }[]
    const breakdown: EndpointBreakdown[] = rows.map((r) => ({
      endpoint:  r.endpoint as ApiEndpoint,
      totalCost: r.total_cost,
      callCount: Number(r.call_count),
    }))
    const total = breakdown.reduce((acc, r) => acc + r.totalCost, 0)
    return { total, breakdown }
  },

  async getAllUsersCostSummary(): Promise<Record<string, number>> {
    const { data, error } = await supabase.rpc('get_all_users_groq_cost')
    if (error || !data) return {}
    const rows = data as { user_id: string; total_cost: number }[]
    return Object.fromEntries(rows.map((r) => [r.user_id, r.total_cost]))
  },

  async getCostSummary(): Promise<CostSummary> {
    const { data, error } = await supabase.rpc('get_groq_cost_summary')
    if (error || !data) return { day: 0, week: 0, month: 0, total: 0 }
    const rows = data as { period: string; cost: number }[]
    const map = Object.fromEntries(rows.map((r) => [r.period, Number(r.cost)]))
    return {
      day:   map['day']   ?? 0,
      week:  map['week']  ?? 0,
      month: map['month'] ?? 0,
      total: map['total'] ?? 0,
    }
  },

  async getProfessionalsCount(): Promise<number> {
    const { data, error } = await supabase.rpc('get_professionals_count')
    if (error || data === null) return 0
    return data as number
  },

  async getActiveUsersCount(): Promise<number> {
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .neq('role', 'master')
      .eq('blocked', false)
      .is('deletion_scheduled_at', null)
    if (error || count === null) return 0
    return count
  },

  async getCostByPatient(userId: string, patientId: string): Promise<CostResult> {
    const { data, error } = await supabase.rpc('get_groq_cost_by_patient', {
      p_user_id:    userId,
      p_patient_id: patientId,
    })
    if (error || !data) return { total: 0, breakdown: [] }
    const rows = data as { endpoint: string; total_cost: number; call_count: number }[]
    const breakdown: EndpointBreakdown[] = rows.map((r) => ({
      endpoint:  r.endpoint as ApiEndpoint,
      totalCost: r.total_cost,
      callCount: Number(r.call_count),
    }))
    const total = breakdown.reduce((acc, r) => acc + r.totalCost, 0)
    return { total, breakdown }
  },
}

// Named exports para os testes importarem diretamente
export const {
  logApiUsage,
  getTotalCostUsd,
  getCostByUser,
  getAllUsersCostSummary,
  getCostByPatient,
  getCostSummary,
  getProfessionalsCount,
  getActiveUsersCount,
} = UsageRepository
