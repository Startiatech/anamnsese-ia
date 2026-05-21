import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
}))

vi.mock('@/server/supabase', () => ({ supabase: mockSupabase }))

import { updateClinicData, updateClinicLogo, clearClinicLogo } from './users'

describe('updateClinicData', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('mapeia campos camelCase -> snake_case e nao toca em logo', async () => {
    await updateClinicData('u1', {
      clinicName: 'C',
      clinicCnpj: '11222333000181',
      clinicAddress: 'R1',
      clinicCep: '01000000',
      clinicPhone: '11999999999',
      clinicEmail: 'c@x.com',
      clinicWebsite: 'https://c.com',
      clinicRtIsSelf: true,
      clinicRtName: '',
      clinicRtRegistry: '',
      clinicBusinessHours: 'Seg-Sex',
    })
    expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({
      clinic_name: 'C',
      clinic_cnpj: '11222333000181',
      clinic_address: 'R1',
      clinic_cep: '01000000',
      clinic_phone: '11999999999',
      clinic_email: 'c@x.com',
      clinic_website: 'https://c.com',
      clinic_rt_is_self: true,
      clinic_rt_name: '',
      clinic_rt_registry: '',
      clinic_business_hours: 'Seg-Sex',
    }))
    const call = mockSupabase.update.mock.calls[0][0] as Record<string, unknown>
    expect(call).not.toHaveProperty('clinic_logo_url')
    expect(call).not.toHaveProperty('clinic_logo_path')
  })
})

describe('updateClinicLogo', () => {
  beforeEach(() => { vi.clearAllMocks() })
  it('atualiza apenas url e path', async () => {
    await updateClinicLogo('u1', { url: 'https://x/y.png', path: 'u1/123.png' })
    expect(mockSupabase.update).toHaveBeenCalledWith({
      clinic_logo_url: 'https://x/y.png',
      clinic_logo_path: 'u1/123.png',
    })
  })
})

describe('clearClinicLogo', () => {
  beforeEach(() => { vi.clearAllMocks() })
  it('zera url e path', async () => {
    await clearClinicLogo('u1')
    expect(mockSupabase.update).toHaveBeenCalledWith({
      clinic_logo_url: null,
      clinic_logo_path: null,
    })
  })
})
