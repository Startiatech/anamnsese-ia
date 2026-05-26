// @vitest-environment jsdom

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// --- hoisted mocks ---
const {
  mockDebitConsultationCredit,
  mockAbandonConsultation,
  mockCompleteConsultation,
  mockPush,
  mockToastDismiss,
  mockToastPromise,
} = vi.hoisted(() => ({
  mockDebitConsultationCredit: vi.fn(),
  mockAbandonConsultation: vi.fn(),
  mockCompleteConsultation: vi.fn(),
  mockPush: vi.fn(),
  mockToastDismiss: vi.fn(),
  mockToastPromise: vi.fn(),
}))

vi.mock('@/server/actions/consultation', () => ({
  debitConsultationCredit: mockDebitConsultationCredit,
  abandonConsultation: mockAbandonConsultation,
  completeConsultation: mockCompleteConsultation,
}))

vi.mock('@/components/trial/trial-end-modal', () => ({
  TrialEndModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="trial-end-modal">TrialEndModal</div> : null,
}))

vi.mock('@/server/actions/feedback', () => ({
  saveFeedback: vi.fn(),
  scheduleAccountDeletion: vi.fn(),
  markFeedbackUpgrade: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('sonner', () => ({
  toast: {
    dismiss: mockToastDismiss,
    promise: mockToastPromise,
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock step components — expose callbacks via test-visible buttons
// Steps 1, 3 capture callbacks; steps 2 and 4 expose a "Continuar" button via nextStep
let capturedOnDebit: (() => Promise<{ error?: string }>) | null = null
let capturedOnTranscriptionComplete: (() => void) | null = null
let capturedOnComplete: (() => void) | null = null

vi.mock('@/components/steps/step-patient', async () => {
  const ctx = await vi.importActual<typeof import('@/context/consultation-context')>('@/context/consultation-context')
  return {
    StepPatient: ({ onDebit }: { onDebit: () => Promise<{ error?: string }> }) => {
      const { nextStep } = ctx.useConsultationFlow()
      capturedOnDebit = onDebit
      return (
        <button
          data-testid="btn-debit"
          onClick={async () => { const r = await onDebit(); if (!r?.error) nextStep() }}
        >
          Confirmar paciente
        </button>
      )
    },
  }
})

vi.mock('@/components/steps/step-responsibility', async () => {
  const ctx = await vi.importActual<typeof import('@/context/consultation-context')>('@/context/consultation-context')
  return {
    StepResponsibility: () => {
      const { nextStep } = ctx.useConsultationFlow()
      return <button data-testid="btn-next-responsibility" onClick={nextStep}>Confirmar</button>
    },
  }
})

vi.mock('@/components/steps/step-audio', async () => {
  const ctx = await vi.importActual<typeof import('@/context/consultation-context')>('@/context/consultation-context')
  return {
    StepAudio: ({ onTranscriptionComplete }: { onTranscriptionComplete: () => void }) => {
      const { nextStep } = ctx.useConsultationFlow()
      capturedOnTranscriptionComplete = onTranscriptionComplete
      return (
        <button
          data-testid="btn-transcribe"
          onClick={() => { onTranscriptionComplete(); nextStep() }}
        >
          Transcrever
        </button>
      )
    },
  }
})

vi.mock('@/components/steps/step-sections', async () => {
  const ctx = await vi.importActual<typeof import('@/context/consultation-context')>('@/context/consultation-context')
  return {
    StepSections: () => {
      const { nextStep } = ctx.useConsultationFlow()
      return <button data-testid="btn-next-sections" onClick={nextStep}>Continuar</button>
    },
  }
})

vi.mock('@/components/steps/step-anamnesis', () => ({
  StepAnamnesis: ({ onComplete }: { onComplete: () => void }) => {
    capturedOnComplete = onComplete
    return <button data-testid="btn-complete" onClick={() => onComplete()}>Finalizar</button>
  },
}))
vi.mock('@/components/steps/step-indicator', () => ({
  StepIndicator: () => <div>StepIndicator</div>,
}))
vi.mock('@/components/ui/logo', () => ({
  Logo: () => <div>Logo</div>,
}))

// Use real ConsultationProvider/context (drives step rendering)
// No mock needed — context starts at step 1 naturally

import { ConsultationPageFlow } from './consultation-page-flow'

const patient = {
  id: 'patient-1',
  name: 'João Silva',
  cpf: '000.000.000-00',
  birthDate: '1990-01-01',
  userId: 'user-1',
  createdAt: new Date().toISOString(),
}

const defaultProps = {
  patient,
  planFeatures: { audioAttemptsLabel: 'Envios de áudio', refinementsLabel: 'Refinamentos' },
  audioAttemptsUsed: 0,
  audioAttemptsLimit: 3,
  refinementAttemptsUsed: 0,
  refinementAttemptsLimit: 2,
  initialTranscript: '',
  professional: { name: 'Dr. Test', specialty: 'Clínica', crm: 'CRM 12345 SP' },
  lastConsultationAt: null,
  creditsRemaining: 10,
  planId: 'basic',
}

function renderFlow(overrides: Partial<typeof defaultProps> = {}) {
  capturedOnDebit = null
  capturedOnTranscriptionComplete = null
  capturedOnComplete = null
  return render(<ConsultationPageFlow {...defaultProps} {...overrides} />)
}

async function confirmDebit() {
  fireEvent.click(screen.getByTestId('btn-debit'))
  await waitFor(() => expect(mockDebitConsultationCredit).toHaveBeenCalled())
}

function clickAbandon() {
  fireEvent.click(screen.getByRole('button', { name: /abandonar consulta/i }))
}

function confirmAbandon() {
  fireEvent.click(screen.getByRole('button', { name: /^abandonar$/i }))
}

describe('ConsultationPageFlow — credit refund logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDebitConsultationCredit.mockResolvedValue({})
    mockAbandonConsultation.mockResolvedValue(undefined)
    mockToastPromise.mockImplementation((promise) => promise)
  })

  it('calls abandonConsultation with aiWasUsed=false when abandoning before transcription', async () => {
    renderFlow()
    await confirmDebit()
    clickAbandon()
    confirmAbandon()
    await waitFor(() => expect(mockAbandonConsultation).toHaveBeenCalled())
    expect(mockAbandonConsultation).toHaveBeenCalledWith('patient-1', expect.any(Number), false)
  })

  it('does NOT call abandonConsultation when abandoning before debit', () => {
    renderFlow()
    clickAbandon()
    confirmAbandon()
    expect(mockAbandonConsultation).not.toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalled()
  })

  it('resets aiWasUsed to false after debit even when initialTranscript is non-empty', async () => {
    // Simulates stale DB state: previous session had a transcript
    renderFlow({ initialTranscript: 'transcrição de sessão anterior' })
    await confirmDebit()
    clickAbandon()
    confirmAbandon()
    await waitFor(() => expect(mockAbandonConsultation).toHaveBeenCalled())
    // Must be false — debit resets consultation in DB, AI not used in this session
    expect(mockAbandonConsultation).toHaveBeenCalledWith('patient-1', expect.any(Number), false)
  })

  it('shows "Crédito será devolvido" in dialog when credit debited and AI not used', async () => {
    renderFlow()
    await confirmDebit()
    clickAbandon()
    expect(screen.getByText(/crédito será devolvido/i)).toBeInTheDocument()
  })

  it('dismisses loading toast on mount', () => {
    renderFlow()
    expect(mockToastDismiss).toHaveBeenCalled()
  })
})

describe('ConsultationPageFlow — TrialEndModal timing (experimental plan, last credit)', () => {
  const trialProps = { creditsRemaining: 1, planId: 'experimental' } as Partial<typeof defaultProps>

  beforeEach(() => {
    vi.clearAllMocks()
    mockDebitConsultationCredit.mockResolvedValue({})
    mockAbandonConsultation.mockResolvedValue(undefined)
    mockCompleteConsultation.mockResolvedValue(undefined)
    mockToastPromise.mockImplementation((promise) => promise)
  })

  it('NÃO exibe TrialEndModal imediatamente após debitar o último crédito', async () => {
    renderFlow(trialProps)
    await confirmDebit()
    expect(screen.queryByTestId('trial-end-modal')).not.toBeInTheDocument()
  })

  it('exibe TrialEndModal após finalizar a consulta com último crédito', async () => {
    renderFlow(trialProps)
    await confirmDebit()
    fireEvent.click(screen.getByTestId('btn-next-responsibility'))
    fireEvent.click(screen.getByTestId('btn-transcribe'))
    fireEvent.click(screen.getByTestId('btn-next-sections'))
    await waitFor(() => expect(screen.getByTestId('btn-complete')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('btn-complete'))
    // CompleteConfirmDialog abre — confirmar "Finalizar"
    await waitFor(() => expect(screen.getByRole('button', { name: /^finalizar$/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /^finalizar$/i }))
    await waitFor(() => expect(screen.getByTestId('trial-end-modal')).toBeInTheDocument())
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('exibe TrialEndModal ao abandonar quando IA foi usada com último crédito', async () => {
    renderFlow(trialProps)
    await confirmDebit()
    fireEvent.click(screen.getByTestId('btn-next-responsibility'))
    fireEvent.click(screen.getByTestId('btn-transcribe'))
    clickAbandon()
    confirmAbandon()
    await waitFor(() => expect(mockAbandonConsultation).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByTestId('trial-end-modal')).toBeInTheDocument())
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('NÃO exibe TrialEndModal ao abandonar sem uso de IA (crédito devolvido)', async () => {
    renderFlow(trialProps)
    await confirmDebit()
    // sem transcrição — aiWasUsed permanece false
    clickAbandon()
    confirmAbandon()
    await waitFor(() => expect(mockAbandonConsultation).toHaveBeenCalled())
    expect(screen.queryByTestId('trial-end-modal')).not.toBeInTheDocument()
    expect(mockPush).toHaveBeenCalled()
  })
})
