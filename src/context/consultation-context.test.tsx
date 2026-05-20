import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConsultationProvider, useConsultationFlow } from './consultation-context'

function TestConsumer() {
  const { state, setPatient, nextStep, prevStep } = useConsultationFlow()
  return (
    <div>
      <span data-testid="step">{state.step}</span>
      <button onClick={() => setPatient({ id: 'p1', name: 'João', cpf: '111.111.111-11', createdAt: '' })}>
        Set Patient
      </button>
      <button onClick={nextStep}>Next</button>
      <button onClick={prevStep}>Prev</button>
    </div>
  )
}

describe('ConsultationContext', () => {
  it('starts at step 1', () => {
    render(<ConsultationProvider planFeatures={{ audioAttemptsLabel: 'L', refinementsLabel: 'R' }} professional={{ name: 'Dr', specialty: 'S', crm: 'C' }} audioAttemptsLimit={null} refinementAttemptsLimit={null} lastConsultationAt={null}><TestConsumer /></ConsultationProvider>)
    expect(screen.getByTestId('step').textContent).toBe('1')
  })

  it('advances to step 2', async () => {
    render(<ConsultationProvider planFeatures={{ audioAttemptsLabel: 'L', refinementsLabel: 'R' }} professional={{ name: 'Dr', specialty: 'S', crm: 'C' }} audioAttemptsLimit={null} refinementAttemptsLimit={null} lastConsultationAt={null}><TestConsumer /></ConsultationProvider>)
    await userEvent.click(screen.getByText('Next'))
    expect(screen.getByTestId('step').textContent).toBe('2')
  })

  it('does not go below step 1', async () => {
    render(<ConsultationProvider planFeatures={{ audioAttemptsLabel: 'L', refinementsLabel: 'R' }} professional={{ name: 'Dr', specialty: 'S', crm: 'C' }} audioAttemptsLimit={null} refinementAttemptsLimit={null} lastConsultationAt={null}><TestConsumer /></ConsultationProvider>)
    await userEvent.click(screen.getByText('Prev'))
    expect(screen.getByTestId('step').textContent).toBe('1')
  })
})

const planFeatures = { audioAttemptsLabel: 'Envios', refinementsLabel: 'Refinamentos' }
const professional = { name: 'Dr. Test', specialty: 'Clínica', crm: 'CRM 1234 SP' }

function Consumer() {
  const { planFeatures: pf, professional: prof, audioAttemptsLimit, refinementAttemptsLimit, lastConsultationAt } = useConsultationFlow()
  return (
    <div>
      <span data-testid="audio-label">{pf.audioAttemptsLabel}</span>
      <span data-testid="prof-name">{prof.name}</span>
      <span data-testid="audio-limit">{audioAttemptsLimit ?? 'null'}</span>
      <span data-testid="ref-limit">{refinementAttemptsLimit ?? 'null'}</span>
      <span data-testid="last-at">{lastConsultationAt ?? 'null'}</span>
    </div>
  )
}

describe('ConsultationContext — static fields', () => {
  it('exposes planFeatures from provider', () => {
    render(
      <ConsultationProvider
        planFeatures={planFeatures}
        professional={professional}
        audioAttemptsLimit={3}
        refinementAttemptsLimit={2}
        lastConsultationAt="2026-04-01T10:00:00Z"
      >
        <Consumer />
      </ConsultationProvider>
    )
    expect(screen.getByTestId('audio-label').textContent).toBe('Envios')
    expect(screen.getByTestId('prof-name').textContent).toBe('Dr. Test')
    expect(screen.getByTestId('audio-limit').textContent).toBe('3')
    expect(screen.getByTestId('ref-limit').textContent).toBe('2')
    expect(screen.getByTestId('last-at').textContent).toBe('2026-04-01T10:00:00Z')
  })

  it('accepts null values for limits and lastConsultationAt', () => {
    render(
      <ConsultationProvider
        planFeatures={planFeatures}
        professional={professional}
        audioAttemptsLimit={null}
        refinementAttemptsLimit={null}
        lastConsultationAt={null}
      >
        <Consumer />
      </ConsultationProvider>
    )
    expect(screen.getByTestId('audio-limit').textContent).toBe('null')
    expect(screen.getByTestId('ref-limit').textContent).toBe('null')
    expect(screen.getByTestId('last-at').textContent).toBe('null')
  })
})
