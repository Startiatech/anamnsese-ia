import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase before importing users
const mockSingle = vi.fn()
const mockInsert = vi.fn()
const mockSelect = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()

vi.mock('@/server/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect.mockReturnThis(),
      insert: mockInsert.mockReturnThis(),
      update: mockUpdate.mockReturnThis(),
      delete: mockDelete.mockReturnThis(),
      eq: mockEq.mockReturnThis(),
      order: mockOrder.mockReturnThis(),
      single: mockSingle,
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    })),
  },
}))

vi.mock('@/server/repositories/system-config', () => ({
  SystemConfigRepository: {
    get: vi.fn().mockResolvedValue('5'),
  },
}))

import { findUserByEmail, findUserById, addUser, listUsers, updateUser, deleteUser } from './users'
import type { StoredUser } from './users'

const mockRow = {
  id: 'uuid-1',
  name: 'Dr. Ana',
  email: 'ana@clinic.com',
  password_hash: 'salt:hash',
  role: 'user',
  specialty: 'Cardiologia',
  plan_selected: false,
  onboarding_completed: false,
  password_is_temp: false,
  blocked: false,
  created_at: '2026-01-01T00:00:00Z',
  credits_remaining: 5,
  minutes_per_consultation: 45,
}

const expectedUser: StoredUser = {
  id: 'uuid-1',
  name: 'Dr. Ana',
  email: 'ana@clinic.com',
  passwordHash: 'salt:hash',
  role: 'user',
  specialty: 'Cardiologia',
  phone: undefined,
  crmType: 'CRM',
  crmNumber: undefined,
  crmUf: undefined,
  planId: 'experimental',
  planSelected: false,
  onboardingCompleted: false,
  passwordIsTemp: false,
  blocked: false,
  createdAt: '2026-01-01T00:00:00Z',
  creditsRemaining: 5,
  deletionScheduledAt: null,
  bonusCredits: 0,
  minutesPerConsultation: 45,
  pinHash: undefined,
  pinIsTemp: false,
  clinicName: undefined,
  clinicCnpj: undefined,
  clinicAddress: undefined,
  clinicAddressNumber: undefined,
  clinicCep: undefined,
  clinicPhone: undefined,
  clinicEmail: undefined,
  clinicWebsite: undefined,
  clinicLogoUrl: undefined,
  clinicLogoPath: undefined,
  clinicRtIsSelf: true,
  clinicRtName: undefined,
  clinicRtRegistry: undefined,
  clinicBusinessHours: undefined,
  prefFontSize: 'normal',
  prefHighContrast: false,
  prefSpacingIncreased: false,
  prefFocusHighlight: false,
  prefExtraReducedMotion: false,
}

beforeEach(() => vi.clearAllMocks())

// ─── findUserByEmail ──────────────────────────────────────────────────────────

describe('findUserByEmail', () => {
  it('returns mapped user when found', async () => {
    mockSingle.mockResolvedValueOnce({ data: mockRow, error: null })
    const user = await findUserByEmail('ana@clinic.com')
    expect(user).toEqual(expectedUser)
  })

  it('returns undefined when not found', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null })
    const user = await findUserByEmail('notfound@example.com')
    expect(user).toBeUndefined()
  })
})

// ─── findUserById ─────────────────────────────────────────────────────────────

describe('findUserById', () => {
  it('returns mapped user when found', async () => {
    mockSingle.mockResolvedValueOnce({ data: mockRow, error: null })
    const user = await findUserById('uuid-1')
    expect(user).toEqual(expectedUser)
  })

  it('returns undefined when not found', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null })
    const user = await findUserById('nonexistent')
    expect(user).toBeUndefined()
  })
})

// ─── addUser ──────────────────────────────────────────────────────────────────

describe('addUser', () => {
  it('calls supabase insert with correct fields', async () => {
    mockInsert.mockResolvedValueOnce({ error: null })
    const newUser: StoredUser = {
      id: 'uuid-2',
      name: 'Dr. Pedro',
      email: 'Pedro@Clinic.com',
      passwordHash: 's:h',
      role: 'user',
      planId: 'experimental',
      planSelected: false,
      onboardingCompleted: false,
      passwordIsTemp: false,
      blocked: false,
      deletionScheduledAt: null,
      bonusCredits: 0,
      minutesPerConsultation: 5,
      pinIsTemp: false,
      createdAt: new Date().toISOString(),
      clinicRtIsSelf: true,
      prefFontSize: 'normal',
      prefHighContrast: false,
      prefSpacingIncreased: false,
      prefFocusHighlight: false,
      prefExtraReducedMotion: false,
    }
    await addUser(newUser)
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'uuid-2',
        email: 'pedro@clinic.com', // lowercased
        name: 'Dr. Pedro',
        role: 'user',
      })
    )
  })
})

// ─── listUsers ────────────────────────────────────────────────────────────────

describe('listUsers', () => {
  it('returns only users with role=user, mapped correctly', async () => {
    mockOrder.mockResolvedValueOnce({ data: [mockRow], error: null })
    const users = await listUsers()
    expect(users).toHaveLength(1)
    expect(users[0]).toEqual(expectedUser)
  })

  it('returns empty array when no users found', async () => {
    mockOrder.mockResolvedValueOnce({ data: null, error: null })
    const users = await listUsers()
    expect(users).toEqual([])
  })
})

// ─── updateUser ───────────────────────────────────────────────────────────────

describe('updateUser', () => {
  it('calls supabase update with name, specialty, phone', async () => {
    mockEq.mockResolvedValueOnce({ error: null })
    await updateUser('uuid-1', { name: 'Dr. Nova', specialty: 'Ortopedia', phone: '11999' })
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Dr. Nova', specialty: 'Ortopedia', phone: '11999' })
    )
  })

  it('calls supabase update with blocked flag', async () => {
    mockEq.mockResolvedValueOnce({ error: null })
    await updateUser('uuid-1', { blocked: true })
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ blocked: true }))
  })
})

// ─── deleteUser ───────────────────────────────────────────────────────────────

describe('deleteUser', () => {
  it('calls supabase delete with correct id', async () => {
    mockEq.mockResolvedValueOnce({ error: null })
    await deleteUser('uuid-1')
    expect(mockDelete).toHaveBeenCalled()
    expect(mockEq).toHaveBeenCalledWith('id', 'uuid-1')
  })
})
