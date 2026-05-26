import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NewPatientForm as NovoPacientePage } from './new-patient-form'

const { mockPush, mockToastError, mockCreatePatient } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockToastError: vi.fn(),
  mockCreatePatient: vi.fn(),
}))

let mockCredits = 1

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/app/consultation/novo',
}))

vi.mock('@/context/app-context', () => ({
  useApp: () => ({ credits: mockCredits, refreshCredits: vi.fn() }),
}))

vi.mock('@/hooks/use-patients', () => ({
  usePatients: () => ({ createPatient: mockCreatePatient }),
}))

vi.mock('sonner', () => ({
  toast: {
    error: mockToastError,
    info: vi.fn(),
    promise: vi.fn((p: Promise<unknown>) => p),
  },
}))

describe('NovoPacientePage — cheque de créditos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCredits = 1
  })

  function fillForm() {
    fireEvent.change(screen.getByLabelText(/nome completo/i), { target: { value: 'João Teste' } })
    fireEvent.change(screen.getByLabelText(/cpf/i), { target: { value: '111.444.777-35' } })
    fireEvent.change(screen.getByLabelText(/data de nascimento/i), { target: { value: '1990-01-01' } })
  }

  it('cria paciente e navega quando há créditos', async () => {
    mockCredits = 1
    mockCreatePatient.mockResolvedValue({ id: 'p-new' })
    render(<NovoPacientePage />)

    fillForm()
    fireEvent.click(screen.getByRole('button', { name: /salvar e iniciar/i }))

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('p-new')))
    expect(mockToastError).not.toHaveBeenCalled()
  })

  it('bloqueia submit e exibe toast de erro quando créditos são zero', async () => {
    mockCredits = 0
    render(<NovoPacientePage />)

    fillForm()
    fireEvent.click(screen.getByRole('button', { name: /salvar e iniciar/i }))

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith(expect.stringMatching(/crédito/i)))
    expect(mockCreatePatient).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })
})
