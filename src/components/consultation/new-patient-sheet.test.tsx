import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NewPatientSheet } from './new-patient-sheet'

vi.mock('sonner', () => ({
  toast: { promise: vi.fn() },
}))

vi.mock('@/lib/routes', () => ({
  API: { patients: '/api/patients' },
}))

vi.mock('@/lib/utils', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/utils')>()),
  formatCPF: (v: string) => v,
  formatPhone: (v: string) => v,
  generateId: () => 'generated-id',
}))

vi.mock('@/components/ui/birth-date-select', () => ({
  BirthDateSelect: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input
      aria-label="data de nascimento"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  onSuccess: vi.fn(),
}

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/nome completo/i), { target: { value: 'João Silva' } })
  fireEvent.change(screen.getByLabelText(/cpf/i), { target: { value: '529.982.247-25' } })
  fireEvent.change(screen.getByLabelText(/data de nascimento/i), { target: { value: '1990-05-10' } })
}

describe('NewPatientSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'generated-id', name: 'João Silva', cpf: '529.982.247-25', birthDate: '1990-05-10', createdAt: new Date().toISOString() }),
    })
  })

  it('renders the Identificação / Prontuário field', () => {
    render(<NewPatientSheet {...defaultProps} />)
    expect(screen.getByLabelText(/identificação \/ prontuário/i)).toBeInTheDocument()
  })

  it('submits without externalId when field is empty', async () => {
    render(<NewPatientSheet {...defaultProps} />)
    fillRequiredFields()
    fireEvent.submit(screen.getByRole('form', { hidden: true }))
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.externalId).toBeUndefined()
  })

  it('submits externalId when field is filled', async () => {
    render(<NewPatientSheet {...defaultProps} />)
    fillRequiredFields()
    fireEvent.change(screen.getByLabelText(/identificação \/ prontuário/i), { target: { value: 'PRONT-42' } })
    fireEvent.submit(screen.getByRole('form', { hidden: true }))
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.externalId).toBe('PRONT-42')
  })
})
