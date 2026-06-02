// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockUpdate, mockEq, mockFrom, mockGetServerUser, mockComparePassword, mockHashPassword, mockFindUserById, mockUpdateAccessibilityPrefs } =
  vi.hoisted(() => ({
    mockUpdate: vi.fn(),
    mockEq: vi.fn(),
    mockFrom: vi.fn(),
    mockGetServerUser: vi.fn(),
    mockComparePassword: vi.fn(),
    mockHashPassword: vi.fn(),
    mockFindUserById: vi.fn(),
    mockUpdateAccessibilityPrefs: vi.fn(),
  }))

vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      json: async () => data,
      status: init?.status ?? 200,
    }),
  },
}))

vi.mock('@/server/supabase', () => ({
  supabase: {
    from: (table: string) => {
      mockFrom(table)
      return {
        update: (data: unknown) => {
          mockUpdate(data)
          return { eq: mockEq }
        },
      }
    },
  },
}))

vi.mock('@/server/services/session', () => ({ getServerUser: mockGetServerUser }))
vi.mock('@/server/services/auth', () => ({ comparePassword: mockComparePassword, hashPassword: mockHashPassword }))
vi.mock('@/server/repositories/users', () => ({
  findUserById: mockFindUserById,
  updateAccessibilityPrefs: mockUpdateAccessibilityPrefs,
}))

import { PATCH } from './route'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: object) {
  return { json: async () => body } as never
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PATCH /api/users/me', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEq.mockResolvedValue({})
    mockGetServerUser.mockResolvedValue({ sub: 'user-1', role: 'user', email: 'a@b.com' })
  })

  describe('password change', () => {
    it('includes password_is_temp: false in the update call', async () => {
      mockFindUserById.mockResolvedValue({
        id: 'user-1', email: 'a@b.com', name: 'Test', passwordHash: 'hashed', role: 'user',
      })
      mockComparePassword.mockResolvedValue(true)
      mockHashPassword.mockResolvedValue('new-hash')

      const res = await PATCH(makeRequest({ currentPassword: 'old', newPassword: 'newpass123' }))
      const json = await res.json()

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ password_hash: 'new-hash', password_is_temp: false }),
      )
      expect(json).toEqual({ ok: true })
    })

    it('rejeita nova senha com menos de 8 caracteres (defesa no servidor)', async () => {
      mockFindUserById.mockResolvedValue({
        id: 'user-1', email: 'a@b.com', name: 'Test', passwordHash: 'hashed', role: 'user',
      })

      const res = await PATCH(makeRequest({ currentPassword: 'old', newPassword: '1234567' }))

      expect(mockComparePassword).not.toHaveBeenCalled()
      expect(mockHashPassword).not.toHaveBeenCalled()
      expect(mockUpdate).not.toHaveBeenCalled()
      expect(res.status).toBe(400)
    })

    it('rejeita nova senha acima de 72 bytes (truncamento bcrypt)', async () => {
      mockFindUserById.mockResolvedValue({
        id: 'user-1', email: 'a@b.com', name: 'Test', passwordHash: 'hashed', role: 'user',
      })

      const longPassword = 'a'.repeat(73)
      const res = await PATCH(makeRequest({ currentPassword: 'old', newPassword: longPassword }))

      expect(mockHashPassword).not.toHaveBeenCalled()
      expect(mockUpdate).not.toHaveBeenCalled()
      expect(res.status).toBe(400)
    })
  })

  describe('profile update', () => {
    it('sets onboarding_completed: true when all 3 fields present', async () => {
      const res = await PATCH(
        makeRequest({ name: 'Dr. Ana', phone: '11999', specialty: 'Clínica Geral', crmType: 'CRM', crmNumber: '12345', crmUf: 'SP' }),
      )
      const json = await res.json()

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ onboarding_completed: true }),
      )
      expect(json).toEqual({ ok: true, onboardingCompleted: true })
    })

    it('does NOT set onboarding_completed when crmNumber is empty', async () => {
      const res = await PATCH(
        makeRequest({ name: 'Dr. Ana', phone: '11999', specialty: 'Clínica Geral', crmType: 'CRM', crmNumber: '', crmUf: 'SP' }),
      )
      const json = await res.json()

      expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty('onboarding_completed')
      expect(json).toEqual({ ok: true, onboardingCompleted: false })
    })

    it('does NOT set onboarding_completed when fields are absent', async () => {
      const res = await PATCH(makeRequest({ name: 'Dr. Ana', phone: '11999' }))
      const json = await res.json()

      expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty('onboarding_completed')
      expect(json).toEqual({ ok: true, onboardingCompleted: false })
    })
  })

  describe('accessibility preferences', () => {
    it('chama updateAccessibilityPrefs e retorna ok quando recebe prefFontSize', async () => {
      mockUpdateAccessibilityPrefs.mockResolvedValue(undefined)

      const res = await PATCH(makeRequest({ prefFontSize: 'large' }))
      const json = await res.json()

      expect(mockUpdateAccessibilityPrefs).toHaveBeenCalledWith('user-1', { fontSize: 'large' })
      expect(json).toEqual({ ok: true })
    })

    it('aceita prefHighContrast booleano', async () => {
      mockUpdateAccessibilityPrefs.mockResolvedValue(undefined)

      const res = await PATCH(makeRequest({ prefHighContrast: true }))
      const json = await res.json()

      expect(mockUpdateAccessibilityPrefs).toHaveBeenCalledWith('user-1', { highContrast: true })
      expect(json).toEqual({ ok: true })
    })

    it('aceita ambos os campos no mesmo PATCH', async () => {
      mockUpdateAccessibilityPrefs.mockResolvedValue(undefined)

      await PATCH(makeRequest({ prefFontSize: 'xlarge', prefHighContrast: true }))

      expect(mockUpdateAccessibilityPrefs).toHaveBeenCalledWith('user-1', { fontSize: 'xlarge', highContrast: true })
    })

    it('rejeita prefFontSize fora do enum', async () => {
      const res = await PATCH(makeRequest({ prefFontSize: 'huge' }))

      expect(mockUpdateAccessibilityPrefs).not.toHaveBeenCalled()
      expect(res.status).toBe(400)
    })

    it('nao chama prefs quando body nao tem campos pref*', async () => {
      await PATCH(makeRequest({ name: 'Dr. Ana' }))

      expect(mockUpdateAccessibilityPrefs).not.toHaveBeenCalled()
    })
  })
})
