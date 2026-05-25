import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React, { forwardRef } from 'react'
import { SettingsClient } from './settings-client'
import type { StoredUser } from '@/server/repositories/users'

// ─── mocks externos ────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), promise: vi.fn((p: Promise<unknown>) => p) },
}))

vi.mock('@/components/dashboard/onboarding-intro-modal', () => ({
  OnboardingIntroModal: () => null,
}))

vi.mock('@/components/ui/underline-tabs', () => ({
  UnderlineTabs: ({
    tabs,
    active,
    onChange,
  }: {
    tabs: { id: string; label: string; disabled?: boolean }[]
    active: string
    onChange: (id: string) => void
  }) => (
    <div>
      {tabs.map((t) => (
        <button
          key={t.id}
          data-testid={`tab-${t.id}`}
          onClick={() => onChange(t.id)}
          disabled={t.disabled}
        >
          {t.label}
        </button>
      ))}
    </div>
  ),
}))

vi.mock('./tabs/tab-profile', () => ({
  TabProfile: forwardRef<
    { validate: () => Promise<boolean>; getValues: () => Record<string, unknown> },
    Record<string, unknown>
  >(function MockTabProfile(_props, ref) {
    React.useImperativeHandle(ref, () => ({
      validate: vi.fn().mockResolvedValue(true),
      getValues: vi.fn().mockReturnValue({ name: 'Dr. Test', specialty: 'Cardio' }),
    }))
    return <div data-testid="tab-profile-mock" />
  }),
}))

vi.mock('./tabs/tab-security', () => ({
  TabSecurity: forwardRef<
    { validate: () => Promise<boolean>; getValues: () => Record<string, unknown>; pinSaved: boolean },
    Record<string, unknown>
  >(function MockTabSecurity(_props, ref) {
    React.useImperativeHandle(ref, () => ({
      validate: vi.fn().mockResolvedValue(true),
      getValues: vi.fn().mockReturnValue({
        currentPassword: 'current',
        newPassword: 'newpass123',
        confirmPassword: 'newpass123',
      }),
      pinSaved: false,
    }))
    return <div data-testid="tab-security-mock" />
  }),
}))

vi.mock('./tabs/tab-clinic', () => ({
  TabClinic: forwardRef<
    { validate: () => Promise<boolean>; getValues: () => Record<string, unknown>; hasLogo: () => boolean },
    Record<string, unknown>
  >(function MockTabClinic(_props, ref) {
    React.useImperativeHandle(ref, () => ({
      validate: vi.fn().mockResolvedValue(true),
      getValues: vi.fn().mockReturnValue({ clinicName: 'Clínica Test' }),
      hasLogo: vi.fn().mockReturnValue(false),
    }))
    return <div data-testid="tab-clinic-mock" />
  }),
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
  clinicRtIsSelf: true,
  prefFontSize: 'normal',
  prefHighContrast: false,
  prefSpacingIncreased: false,
  prefFocusHighlight: false,
  prefExtraReducedMotion: false,
  betaA11yV2: false,
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

describe('SettingsClient — aba Clínica', () => {
  it('renderiza aba Clínica no onboarding entre Perfil e Segurança', () => {
    renderSettings({ isOnboarding: true })

    // As três abas devem estar presentes
    expect(screen.getByTestId('tab-perfil')).toBeInTheDocument()
    expect(screen.getByTestId('tab-clinica')).toBeInTheDocument()
    expect(screen.getByTestId('tab-seguranca')).toBeInTheDocument()

    // Ordem: Perfil → Clínica → Segurança
    const tabs = screen.getAllByRole('button').filter((b) =>
      ['tab-perfil', 'tab-clinica', 'tab-seguranca'].includes(b.getAttribute('data-testid') ?? ''),
    )
    expect(tabs[0]).toHaveAttribute('data-testid', 'tab-perfil')
    expect(tabs[1]).toHaveAttribute('data-testid', 'tab-clinica')
    expect(tabs[2]).toHaveAttribute('data-testid', 'tab-seguranca')
  })

  it('com forceClinic=true, Perfil e Segurança ficam desabilitados e banner aparece', () => {
    renderSettings({ forceClinic: true })

    expect(screen.getByTestId('tab-perfil')).toBeDisabled()
    expect(screen.getByTestId('tab-seguranca')).toBeDisabled()

    // Banner amarelo
    expect(
      screen.getByText(/complete os dados da sua clínica/i),
    ).toBeInTheDocument()
  })
})
