// @vitest-environment jsdom
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockSaveConsultation, mockToastPromise, mockToastSuccess, mockFetch } = vi.hoisted(() => ({
  mockSaveConsultation: vi.fn(),
  mockToastPromise: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockFetch: vi.fn(),
}))

vi.stubGlobal('fetch', mockFetch)

vi.mock('@/hooks/use-consultation', () => ({
  useConsultation: () => ({ saveConsultation: mockSaveConsultation }),
}))

vi.mock('sonner', () => ({
  toast: {
    promise: mockToastPromise,
    success: mockToastSuccess,
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}))

vi.mock('@/context/consultation-context', () => ({
  useConsultationFlow: () => ({
    state: {
      rawTranscript: 'transcript',
      structuredAnamnesis: {
        sections: [
          { title: 'Queixa Principal', content: 'Dor de cabeça' },
          { title: 'Histórico de Doenças Atuais', content: 'Hipertensão' },
        ],
      },
      patient: { name: 'João', cpf: '000.000.000-00', birthDate: '1990-01-01', phone: '11999999999' },
    },
    setStructuredAnamnesis: vi.fn(),
    professional: { name: 'Dr. Test', specialty: 'Clínica', crm: 'CRM 1234 SP' },
    refinementAttemptsLimit: 3,
  }),
}))

vi.mock('@/components/ui/logo', () => ({ Logo: () => <div>Logo</div> }))

import { StepAnamnesis } from './step-anamnesis'

const defaultProps = {
  patientId: 'patient-1',
  onComplete: vi.fn(),
  refinementAttemptsUsed: 0,
}

function renderComponent(overrides = {}) {
  return render(<StepAnamnesis {...defaultProps} {...overrides} />)
}

describe('StepAnamnesis — exportações na página', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exibe botão Exportar PDF na página', () => {
    renderComponent()
    expect(screen.getByRole('button', { name: /exportar pdf/i })).toBeInTheDocument()
  })

  it('exibe botão Exportar DOCX na página', () => {
    renderComponent()
    expect(screen.getByRole('button', { name: /exportar docx/i })).toBeInTheDocument()
  })

  it('exibe botão Copiar texto na página', () => {
    renderComponent()
    expect(screen.getByRole('button', { name: /copiar texto/i })).toBeInTheDocument()
  })
})

describe('StepAnamnesis — modal de finalização simplificado', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSaveConsultation.mockResolvedValue({ id: 'c-1' })
    mockToastPromise.mockImplementation((p) => p)
  })

  it('botão Finalizar Atendimento está sempre habilitado (sem gate de exportação)', () => {
    renderComponent()
    expect(screen.getByRole('button', { name: /finalizar atendimento/i })).toBeEnabled()
  })

  it('abre modal de confirmação ao clicar em Finalizar Atendimento', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /finalizar atendimento/i }))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })

  it('modal informa que anamnese estará disponível no histórico', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /finalizar atendimento/i }))
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveTextContent(/histórico/i)
  })

  it('modal NÃO exibe botões de exportação PDF ou DOCX', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /finalizar atendimento/i }))
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.querySelector('button[data-export="pdf"]')).toBeNull()
    expect(dialog.querySelector('button[data-export="docx"]')).toBeNull()
  })

  it('botão Finalizar no modal está habilitado sem nenhuma exportação prévia', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /finalizar atendimento/i }))
    const finalizeBtn = screen.getByRole('button', { name: /^finalizar$/i })
    expect(finalizeBtn).toBeEnabled()
  })

  it('clicar em Finalizar no modal chama saveConsultation e onComplete', async () => {
    const onComplete = vi.fn()
    renderComponent({ onComplete })
    fireEvent.click(screen.getByRole('button', { name: /finalizar atendimento/i }))
    fireEvent.click(screen.getByRole('button', { name: /^finalizar$/i }))
    await waitFor(() => expect(mockSaveConsultation).toHaveBeenCalled())
    await waitFor(() => expect(onComplete).toHaveBeenCalled())
  })
})

describe('StepAnamnesis — select de bloco no refinamento', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockToastPromise.mockImplementation((p) => p)
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ sections: [], refinementCount: 1 }),
    })
  })

  it('exibe select de bloco com opção "Anamnese completa" e os títulos das seções', () => {
    renderComponent()
    expect(screen.getByRole('combobox', { name: /bloco/i })).toBeInTheDocument()
  })

  it('select tem "Anamnese completa" como valor padrão', () => {
    renderComponent()
    expect(screen.getByRole('combobox', { name: /bloco/i })).toHaveTextContent(/anamnese completa/i)
  })

  it('botão Refinar fica habilitado ao preencher instrução com bloco padrão', async () => {
    renderComponent()
    const textarea = screen.getByPlaceholderText(/o que ajustar/i)
    fireEvent.change(textarea, { target: { value: 'Tom mais formal' } })
    expect(screen.getByRole('button', { name: /^refinar$/i })).toBeEnabled()
  })

  it('ao refinar com "Anamnese completa", envia instrução sem prefixo de bloco', async () => {
    renderComponent()
    const textarea = screen.getByPlaceholderText(/o que ajustar/i)
    fireEvent.change(textarea, { target: { value: 'Tom mais formal' } })
    fireEvent.click(screen.getByRole('button', { name: /^refinar$/i }))
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(body.instruction).toBe('Tom mais formal')
  })

  it('ao refinar com bloco específico selecionado, instrução inclui prefixo do bloco', async () => {
    const { getByRole } = renderComponent()
    // Abre o select e seleciona "Queixa Principal"
    fireEvent.click(getByRole('combobox', { name: /bloco/i }))
    fireEvent.click(screen.getByRole('option', { name: /queixa principal/i }))
    const textarea = screen.getByPlaceholderText(/o que ajustar/i)
    fireEvent.change(textarea, { target: { value: 'Mais detalhes' } })
    fireEvent.click(screen.getByRole('button', { name: /^refinar$/i }))
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(body.instruction).toContain('Queixa Principal')
    expect(body.instruction).toContain('Mais detalhes')
  })

  it('textarea é limpo após refinamento bem-sucedido', async () => {
    renderComponent()
    const textarea = screen.getByPlaceholderText(/o que ajustar/i)
    fireEvent.change(textarea, { target: { value: 'Tom mais formal' } })
    fireEvent.click(screen.getByRole('button', { name: /^refinar$/i }))
    await waitFor(() => expect((textarea as HTMLTextAreaElement).value).toBe(''))
  })
})

describe('StepAnamnesis — contagem de refinamentos após falha', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockToastPromise.mockImplementation((p) => p)
  })

  it('mantém contagem incrementada após falha não-429 (crédito já foi cobrado no servidor)', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Erro interno' }),
    })
    renderComponent({ refinementAttemptsUsed: 1 })
    const textarea = screen.getByPlaceholderText(/o que ajustar/i)
    fireEvent.change(textarea, { target: { value: 'Tom mais formal' } })
    fireEvent.click(screen.getByRole('button', { name: /^refinar$/i }))
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument())
  })

  it('reverte contagem após erro 429 (cota NÃO foi consumida pelo servidor)', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: 'Limite de refinamentos atingido para este plano.' }),
    })
    renderComponent({ refinementAttemptsUsed: 2 })
    const textarea = screen.getByPlaceholderText(/o que ajustar/i)
    fireEvent.change(textarea, { target: { value: 'Tom mais formal' } })
    fireEvent.click(screen.getByRole('button', { name: /^refinar$/i }))
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument())
  })
})
