import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React, { forwardRef } from 'react'
import { SettingsClient } from './settings-client'
import type { StoredUser } from '@/server/repositories/users'
import type { SecurityHandle } from './tabs/tab-security'

// ─── mocks externos ────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

const { mockToast } = vi.hoisted(() => ({
  mockToast: { error: vi.fn(), promise: vi.fn((p: Promise<unknown>) => p) },
}))

vi.mock('sonner', () => ({ toast: mockToast }))

// ─── controle do handle de segurança ───────────────────────────────────────

let securityHandleOverride: Partial<SecurityHandle> = {}

vi.mock('./tabs/tab-security', () => ({
  TabSecurity: forwardRef<SecurityHandle, Record<string, unknown>>(
    function MockTabSecurity(_props, ref) {
      React.useImperativeHandle(ref, () => ({
        validate: vi.fn().mockResolvedValue(true),
        getValues: vi.fn().mockReturnValue({
          currentPassword: 'current',
          newPassword: 'newpass123',
          confirmPassword: 'newpass123',
        }),
        pinSaved: false,
        ...securityHandleOverride,
      }))
      return <div data-testid="tab-security-mock" />
    },
  ),
}))

vi.mock('./tabs/tab-profile', () => ({
  TabProfile: forwardRef<{ validate: () => Promise<boolean>; getValues: () => Record<string, unknown> }, Record<string, unknown>>(
    function MockTabProfile(_props, ref) {
      React.useImperativeHandle(ref, () => ({
        validate: vi.fn().mockResolvedValue(true),
        getValues: vi.fn().mockReturnValue({ name: 'Dr. Test', specialty: 'Cardio' }),
      }))
      return <div data-testid="tab-profile-mock" />
    },
  ),
}))

vi.mock('@/components/dashboard/onboarding-intro-modal', () => ({
  OnboardingIntroModal: () => null,
}))

vi.mock('./tabs/tab-clinic', () => ({
  TabClinic: React.forwardRef<
    { validate: () => Promise<boolean>; getValues: () => Record<string, unknown>; hasLogo: () => boolean },
    Record<string, unknown>
  >(function MockTabClinic(_props, ref) {
    React.useImperativeHandle(ref, () => ({
      validate: vi.fn().mockResolvedValue(true),
      getValues: vi.fn().mockReturnValue({ clinicName: 'Clínica Test' }),
      hasLogo: vi.fn().mockReturnValue(false),
    }))
    return React.createElement('div', { 'data-testid': 'tab-clinic-mock' })
  }),
}))

vi.mock('@/components/ui/underline-tabs', () => ({
  UnderlineTabs: ({ tabs, active, onChange }: { tabs: { id: string; label: string; disabled?: boolean }[]; active: string; onChange: (id: string) => void }) => (
    <div>
      {tabs.map((t) => (
        <button key={t.id} data-testid={`tab-${t.id}`} onClick={() => onChange(t.id)} disabled={t.disabled}>
          {t.label}
        </button>
      ))}
    </div>
  ),
}))

// ─── helper ────────────────────────────────────────────────────────────────

const baseUser: StoredUser = {
  id: 'user-1',
  name: 'Dr. Test',
  email: 'test@test.com',
  passwordHash: 'hash',
  role: 'user',
  planId: 'plan-1',
  planSelected: true,
  onboardingCompleted: false,
  passwordIsTemp: true,
  blocked: false,
  createdAt: '2024-01-01T00:00:00Z',
  deletionScheduledAt: null,
  bonusCredits: 0,
  minutesPerConsultation: 30,
  pinIsTemp: false,
}

function renderSettings(props: Partial<React.ComponentProps<typeof SettingsClient>> = {}) {
  return render(
    <SettingsClient
      user={baseUser}
      isOnboarding={false}
      isPasswordReset={false}
      isPinReset={false}
      profileCompleted={false}
      showIntro={false}
      {...props}
    />,
  )
}

// ─── testes ────────────────────────────────────────────────────────────────

describe('SettingsClient — handleProceed PIN obrigatório', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    securityHandleOverride = {}
  })

  it('onboarding sem PIN salvo: bloqueia e exibe toast.error', async () => {
    // pinSaved = false (default do mock)
    securityHandleOverride = { pinSaved: false }

    renderSettings({
      isOnboarding: true,
      isPasswordReset: false,
      isPinReset: false,
      profileCompleted: true,
    })

    // Navega para aba segurança
    fireEvent.click(screen.getByTestId('tab-seguranca'))

    // Clica em "Salvar alterações"
    const btn = screen.getByRole('button', { name: /salvar alterações/i })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        expect.stringMatching(/PIN/i),
      )
    })

    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  it('isPinReset sem PIN salvo: bloqueia e exibe toast.error', async () => {
    securityHandleOverride = { pinSaved: false }

    // isPinReset combinado com isOnboarding — botão unificado só existe no fluxo onboarding
    renderSettings({
      isOnboarding: true,
      isPasswordReset: false,
      isPinReset: true,
      profileCompleted: true,
    })

    fireEvent.click(screen.getByTestId('tab-seguranca'))

    const btn = screen.getByRole('button', { name: /salvar alterações/i })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        expect.stringMatching(/PIN/i),
      )
    })

    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  it('onboarding COM PIN salvo: não bloqueia (não chama toast.error)', async () => {
    securityHandleOverride = { pinSaved: true }
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }))

    renderSettings({
      isOnboarding: true,
      isPasswordReset: false,
      isPinReset: false,
      profileCompleted: true,
    })

    fireEvent.click(screen.getByTestId('tab-seguranca'))

    const btn = screen.getByRole('button', { name: /salvar alterações/i })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(mockToast.error).not.toHaveBeenCalled()
    })
  })

  it('não-onboarding sem PIN: não bloqueia (PIN não é obrigatório)', async () => {
    securityHandleOverride = { pinSaved: false }

    renderSettings({
      isOnboarding: false,
      isPasswordReset: false,
      isPinReset: false,
      profileCompleted: true,
    })

    // Botão de salvar não existe fora do onboarding
    expect(screen.queryByRole('button', { name: /salvar alterações/i })).toBeNull()
  })
})
