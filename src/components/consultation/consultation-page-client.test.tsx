import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConsultationPageClient } from './consultation-page-client'
import type { PatientWithStats } from '@/types'

const { mockPush, mockToastError, mockToastLoading } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockToastError: vi.fn(),
  mockToastLoading: vi.fn(),
}))

let mockCredits = 1

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/consultation',
}))

vi.mock('@/context/app-context', () => ({
  useApp: () => ({ credits: mockCredits }),
}))

vi.mock('sonner', () => ({
  toast: {
    loading: mockToastLoading,
    error: mockToastError,
    promise: vi.fn((p: Promise<unknown>) => p),
  },
}))

vi.mock('@/components/consultation/new-patient-sheet', () => ({
  NewPatientSheet: () => null,
}))

vi.mock('@/components/consultation/patient-row-actions', () => ({
  PatientRowActions: () => null,
}))

const patient: PatientWithStats = {
  id: 'p-1',
  name: 'Ana Silva',
  cpf: '000.000.000-00',
  birthDate: undefined,
  phone: undefined,
  createdAt: new Date().toISOString(),
  consultationCount: 0,
  lastConsultationAt: undefined,
}

const patients: PatientWithStats[] = [
  { ...patient, id: 'p-1', name: 'Ana Silva', cpf: '111.111.111-11' },
  { ...patient, id: 'p-2', name: 'Bruno Matos', cpf: '222.222.222-22' },
  { ...patient, id: 'p-3', name: 'Carla Dias', cpf: '333.333.333-33' },
]

describe('ConsultationPageClient — busca de pacientes', () => {
  beforeEach(() => { vi.clearAllMocks(); mockCredits = 1 })

  it('exibe todos os pacientes sem busca', () => {
    render(<ConsultationPageClient initialPatients={patients} />)
    expect(screen.getByText('Ana Silva')).toBeInTheDocument()
    expect(screen.getByText('Bruno Matos')).toBeInTheDocument()
    expect(screen.getByText('Carla Dias')).toBeInTheDocument()
  })

  it('filtra por nome (case-insensitive)', () => {
    render(<ConsultationPageClient initialPatients={patients} />)
    fireEvent.change(screen.getByPlaceholderText(/buscar paciente/i), { target: { value: 'ana' } })
    expect(screen.getByText('Ana Silva')).toBeInTheDocument()
    expect(screen.queryByText('Bruno Matos')).not.toBeInTheDocument()
    expect(screen.queryByText('Carla Dias')).not.toBeInTheDocument()
  })

  it('filtra por CPF (somente dígitos)', () => {
    render(<ConsultationPageClient initialPatients={patients} />)
    fireEvent.change(screen.getByPlaceholderText(/buscar paciente/i), { target: { value: '222' } })
    expect(screen.queryByText('Ana Silva')).not.toBeInTheDocument()
    expect(screen.getByText('Bruno Matos')).toBeInTheDocument()
  })

  it('exibe mensagem quando busca não retorna resultados', () => {
    render(<ConsultationPageClient initialPatients={patients} />)
    fireEvent.change(screen.getByPlaceholderText(/buscar paciente/i), { target: { value: 'zzzninguem' } })
    expect(screen.getByText(/nenhum paciente encontrado/i)).toBeInTheDocument()
  })
})

describe('ConsultationPageClient — cheque de créditos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCredits = 1
  })

  it('navega para atendimento quando há créditos', () => {
    mockCredits = 1
    render(<ConsultationPageClient initialPatients={[patient]} />)
    fireEvent.click(screen.getByRole('button', { name: /iniciar atendimento/i }))
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('p-1'))
    expect(mockToastError).not.toHaveBeenCalled()
  })

  it('bloqueia navegação e exibe toast de erro quando créditos são zero', () => {
    mockCredits = 0
    render(<ConsultationPageClient initialPatients={[patient]} />)
    fireEvent.click(screen.getByRole('button', { name: /iniciar atendimento/i }))
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockToastError).toHaveBeenCalledWith(expect.stringMatching(/crédito/i))
  })
})
