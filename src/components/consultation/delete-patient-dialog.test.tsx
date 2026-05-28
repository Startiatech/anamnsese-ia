import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DeletePatientDialog } from './delete-patient-dialog'
import type { PatientWithStats } from '@/types'

vi.mock('sonner', () => ({
  toast: { promise: vi.fn() },
}))

vi.mock('@/lib/routes', () => ({
  API: { patientId: (id: string) => `/api/patients/${id}` },
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

function makePatient(consultationCount: number): PatientWithStats {
  return {
    id: 'p-1',
    name: 'Ana Lima',
    cpf: '123.456.789-00',
    createdAt: '2024-01-01T00:00:00Z',
    consultationCount,
    hasAnamnesis: consultationCount > 0,
  }
}

describe('DeletePatientDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
  })

  it('shows simple message when patient has no consultations', () => {
    render(
      <DeletePatientDialog
        open={true}
        onOpenChange={vi.fn()}
        patient={makePatient(0)}
        onSuccess={vi.fn()}
      />
    )
    expect(screen.getByText(/Esta ação não pode ser desfeita/i)).toBeInTheDocument()
    expect(screen.queryByText(/consulta/i)).not.toBeInTheDocument()
  })

  it('shows consultation count warning when patient has consultations', () => {
    render(
      <DeletePatientDialog
        open={true}
        onOpenChange={vi.fn()}
        patient={makePatient(3)}
        onSuccess={vi.fn()}
      />
    )
    expect(screen.getByText(/3 consulta/i)).toBeInTheDocument()
  })

  it('calls DELETE and invokes fetch on confirm click', async () => {
    render(
      <DeletePatientDialog
        open={true}
        onOpenChange={vi.fn()}
        patient={makePatient(0)}
        onSuccess={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /excluir/i }))
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/patients/p-1',
        expect.objectContaining({ method: 'DELETE' }),
      )
    })
  })
})
