// src/server/repositories/db-count.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}))

vi.mock('@/server/supabase', () => ({
  supabase: { from: mockFrom },
}))

import { ConsultationRepository } from './db'

describe('ConsultationRepository.countByPeriod', () => {
  beforeEach(() => vi.clearAllMocks())

  it('conta consultas do dia atual', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      not: vi.fn().mockResolvedValue({ data: [{}, {}], error: null }),
    }
    mockFrom.mockReturnValue(chain)

    const count = await ConsultationRepository.countByPeriod('u1', 'today')
    expect(count).toBe(2)
  })

  it('conta consultas da semana', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      not: vi.fn().mockResolvedValue({ data: [{}], error: null }),
    }
    mockFrom.mockReturnValue(chain)

    const count = await ConsultationRepository.countByPeriod('u1', 'week')
    expect(count).toBe(1)
  })

  it('usa segunda-feira da semana atual como inicio do period week', async () => {
    const gteCapture = vi.fn().mockReturnThis()
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: gteCapture,
      not: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    mockFrom.mockReturnValue(chain)

    await ConsultationRepository.countByPeriod('u1', 'week')

    const since = new Date(gteCapture.mock.calls[0][1] as string)
    const day = since.getDay()
    // since deve ser segunda-feira (day 1) e meia-noite local
    expect(day).toBe(1)
    expect(since.getHours()).toBe(0)
    expect(since.getMinutes()).toBe(0)
    expect(since.getSeconds()).toBe(0)
  })

  it('conta consultas do mes', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      not: vi.fn().mockResolvedValue({ data: [{}, {}, {}], error: null }),
    }
    mockFrom.mockReturnValue(chain)

    const count = await ConsultationRepository.countByPeriod('u1', 'month')
    expect(count).toBe(3)
  })
})
