import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { HistoryClient } from './history-client'
import type { Consultation, Patient } from '@/types'

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('@/lib/routes', () => ({
  ROUTES: {
    resultado: (id: string) => `/app/result/${id}`,
    atendimento: '/app/consultation',
  },
  API: { consultationsPage: (offset: number, limit: number) => `/api/consultations?offset=${offset}&limit=${limit}` },
}))

function makeConsultation(id: string, patientId: string, withAnamnesis = true): Consultation {
  return {
    id,
    patientId,
    rawTranscript: '',
    structuredAnamnesis: withAnamnesis
      ? { sections: [{ title: 'S', content: 'texto' }] }
      : { sections: [] },
    createdAt: '2024-06-15T10:00:00Z',
    updatedAt: '2024-06-15T10:00:00Z',
  }
}

const patientsById: Record<string, Patient> = {
  'pat-1': { id: 'pat-1', name: 'Ana Silva', cpf: '111.111.111-11', createdAt: '2024-01-01T00:00:00Z' },
  'pat-2': { id: 'pat-2', name: 'Bruno Matos', cpf: '222.222.222-22', createdAt: '2024-01-01T00:00:00Z' },
  'pat-3': { id: 'pat-3', name: 'Carla Dias', cpf: '333.333.333-33', createdAt: '2024-01-01T00:00:00Z' },
}

const consultations: Consultation[] = [
  makeConsultation('c-1', 'pat-1'),
  makeConsultation('c-2', 'pat-2'),
]

describe('HistoryClient — tabela de atendimentos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exibe cabeçalhos da tabela', () => {
    render(<HistoryClient consultations={consultations} patientsById={patientsById} hasMore={false} />)
    expect(screen.getByRole('columnheader', { name: /paciente/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /cpf/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /data/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /anamnese/i })).toBeInTheDocument()
  })

  it('exibe todos os atendimentos sem filtro', () => {
    render(<HistoryClient consultations={consultations} patientsById={patientsById} hasMore={false} />)
    expect(screen.getByText('Ana Silva')).toBeInTheDocument()
    expect(screen.getByText('Bruno Matos')).toBeInTheDocument()
  })

  it('filtra por nome do paciente (case-insensitive)', () => {
    render(<HistoryClient consultations={consultations} patientsById={patientsById} hasMore={false} />)
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: 'ana' } })
    expect(screen.getByText('Ana Silva')).toBeInTheDocument()
    expect(screen.queryByText('Bruno Matos')).not.toBeInTheDocument()
  })

  it('exibe mensagem quando busca não retorna resultados', () => {
    render(<HistoryClient consultations={consultations} patientsById={patientsById} hasMore={false} />)
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: 'zzzninguem' } })
    expect(screen.getByText(/nenhum atendimento encontrado/i)).toBeInTheDocument()
  })

  it('exibe CPF do paciente na coluna correspondente', () => {
    render(<HistoryClient consultations={consultations} patientsById={patientsById} hasMore={false} />)
    expect(screen.getByText('111.111.111-11')).toBeInTheDocument()
  })
})

describe('HistoryClient — badge de status da anamnese', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exibe badge "Gerada" quando anamnese existe', () => {
    render(<HistoryClient consultations={[makeConsultation('c-1', 'pat-1', true)]} patientsById={patientsById} hasMore={false} />)
    expect(screen.getByText('Gerada', { selector: 'span' })).toBeInTheDocument()
  })

  it('exibe badge "Pendente" quando anamnese não existe', () => {
    render(<HistoryClient consultations={[makeConsultation('c-1', 'pat-1', false)]} patientsById={patientsById} hasMore={false} />)
    expect(screen.getByText('Pendente', { selector: 'span' })).toBeInTheDocument()
  })

  it('exibe link "Ver anamnese" apenas para consulta com anamnese', () => {
    const mixed = [
      makeConsultation('c-1', 'pat-1', true),
      makeConsultation('c-2', 'pat-2', false),
    ]
    render(<HistoryClient consultations={mixed} patientsById={patientsById} hasMore={false} />)
    const links = screen.getAllByRole('link', { name: /ver anamnese/i })
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', '/app/result/c-1')
  })
})

describe('HistoryClient — carregar mais', () => {
  beforeEach(() => vi.clearAllMocks())

  it('não exibe botão quando hasMore=false', () => {
    render(<HistoryClient consultations={consultations} patientsById={patientsById} hasMore={false} />)
    expect(screen.queryByRole('button', { name: /carregar mais/i })).not.toBeInTheDocument()
  })

  it('exibe botão quando hasMore=true', () => {
    render(<HistoryClient consultations={consultations} patientsById={patientsById} hasMore={true} />)
    expect(screen.getByRole('button', { name: /carregar mais/i })).toBeInTheDocument()
  })

  it('ao clicar carrega novos atendimentos e os exibe', async () => {
    const nextConsultation = makeConsultation('c-3', 'pat-3')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [nextConsultation],
    }))

    render(<HistoryClient consultations={consultations} patientsById={patientsById} hasMore={true} />)
    fireEvent.click(screen.getByRole('button', { name: /carregar mais/i }))

    await waitFor(() => expect(screen.getByText('Carla Dias')).toBeInTheDocument())
    expect(screen.getByText('Ana Silva')).toBeInTheDocument()
    expect(screen.getByText('Bruno Matos')).toBeInTheDocument()
  })

  it('oculta botão após carregar último lote', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }))

    render(<HistoryClient consultations={consultations} patientsById={patientsById} hasMore={true} />)
    fireEvent.click(screen.getByRole('button', { name: /carregar mais/i }))

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /carregar mais/i })).not.toBeInTheDocument()
    )
  })

  it('desabilita botão durante o carregamento', async () => {
    let resolveFetch!: (v: unknown) => void
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(
      new Promise((res) => { resolveFetch = res })
    ))

    render(<HistoryClient consultations={consultations} patientsById={patientsById} hasMore={true} />)
    fireEvent.click(screen.getByRole('button', { name: /carregar mais/i }))

    expect(screen.getByRole('button', { name: /carregando/i })).toBeDisabled()
    resolveFetch({ ok: true, json: async () => [] })
  })
})
