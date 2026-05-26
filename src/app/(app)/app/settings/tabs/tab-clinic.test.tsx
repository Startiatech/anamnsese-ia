import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createRef } from 'react'
import { TabClinic, type ClinicHandle } from './tab-clinic'
import type { StoredUser } from '@/server/repositories/users'

function baseUser(over: Partial<StoredUser> = {}): StoredUser {
  return {
    id: 'u1', name: 'Doc', email: 'd@x.com', passwordHash: 'h', role: 'user',
    planId: 'experimental', planSelected: false, onboardingCompleted: false,
    passwordIsTemp: false, blocked: false, createdAt: '2026-01-01',
    deletionScheduledAt: null, bonusCredits: 0, minutesPerConsultation: 45,
    pinIsTemp: false, clinicRtIsSelf: true, ...over,
  } as StoredUser
}

describe('TabClinic', () => {
  it('toggle RT esconde campos por padrao e mostra ao desmarcar', () => {
    render(<TabClinic ref={createRef<ClinicHandle>()} user={baseUser()} />)
    expect(screen.queryByLabelText(/nome do respons.vel t.cnico/i)).toBeNull()
    fireEvent.click(screen.getByLabelText(/sou o respons.vel t.cnico/i))
    expect(screen.getByLabelText(/nome do respons.vel t.cnico/i)).toBeTruthy()
  })

  it('campo Site mostra "(opcional)" no label', () => {
    render(<TabClinic ref={createRef<ClinicHandle>()} user={baseUser()} />)
    expect(screen.getByText(/site\s*\(opcional\)/i)).toBeTruthy()
  })

  it('validate retorna false quando campos obrigatorios vazios', async () => {
    const ref = createRef<ClinicHandle>()
    render(<TabClinic ref={ref} user={baseUser()} />)
    const ok = await ref.current!.validate()
    expect(ok).toBe(false)
  })
})
