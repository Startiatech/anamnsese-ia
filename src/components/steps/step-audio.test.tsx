import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { StepAudio } from './step-audio'

// ── Mocks globais ────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(() => 'toast-id'),
    dismiss: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/context/consultation-context', () => ({
  useConsultationFlow: () => ({
    nextStep: vi.fn(),
    setRawTranscript: vi.fn(),
    audioAttemptsLimit: null,
    setIsTranscribing: vi.fn(),
  }),
}))

// ── Mock MediaRecorder ───────────────────────────────────────────────────────

type DataAvailableHandler = (e: { data: Blob }) => void
type VoidHandler = () => void

class MockMediaRecorder {
  state: 'inactive' | 'recording' | 'paused' = 'inactive'
  ondataavailable: DataAvailableHandler | null = null
  onstop: VoidHandler | null = null
  stream: MediaStream

  constructor(stream: MediaStream) {
    this.stream = stream
    MockMediaRecorder.instances.push(this)
  }

  start(_timeslice?: number) {
    this.state = 'recording'
  }

  pause() {
    this.state = 'paused'
  }

  resume() {
    this.state = 'recording'
  }

  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['audio-data'], { type: 'audio/webm' }) })
    this.onstop?.()
  }

  static instances: MockMediaRecorder[] = []
  static reset() { MockMediaRecorder.instances = [] }
}

// ── Mock MediaStream / track ─────────────────────────────────────────────────

function makeMockTrack() {
  return { enabled: true, stop: vi.fn() }
}

function makeMockStream(track = makeMockTrack()) {
  return {
    getTracks: () => [track],
    getAudioTracks: () => [track],
    _track: track,
  } as unknown as MediaStream
}

// ── Mock fetch (transcribe) ──────────────────────────────────────────────────

function makeStreamResponse(text: string) {
  const encoder = new TextEncoder()
  const chunks = [encoder.encode(`${text}\n__DONE__\n`)]
  let idx = 0
  return {
    ok: true,
    status: 200,
    json: async () => ({}),
    body: {
      getReader: () => ({
        read: async () => {
          if (idx < chunks.length) return { done: false, value: chunks[idx++] }
          return { done: true, value: undefined }
        },
      }),
    },
  } as unknown as Response
}

// ── Props padrão ─────────────────────────────────────────────────────────────

const defaultProps = {
  patientId: 'p-1',
  audioAttemptsUsed: 0,
  initialTranscript: '',
  onTranscriptionComplete: vi.fn(),
}

// ── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  MockMediaRecorder.reset()
  vi.stubGlobal('MediaRecorder', MockMediaRecorder)
  vi.stubGlobal('fetch', vi.fn(() => makeStreamResponse('Paciente relata dor de cabeça.')))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderStepAudio(props = {}) {
  return render(<StepAudio {...defaultProps} {...props} />)
}

async function switchToRecordMode() {
  fireEvent.click(screen.getByRole('tab', { name: /gravar consulta/i }))
}

async function startRecording(mockStream: MediaStream) {
  vi.stubGlobal(
    'navigator',
    { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(mockStream) } },
  )
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /iniciar gravação/i }))
  })
  await waitFor(() => expect(MockMediaRecorder.instances).toHaveLength(1))
}

// ════════════════════════════════════════════════════════════════════════════
// TESTES
// ════════════════════════════════════════════════════════════════════════════

describe('StepAudio — seleção de modo', () => {
  it('renderiza as duas abas: Enviar arquivo e Gravar consulta', () => {
    renderStepAudio()
    expect(screen.getByRole('tab', { name: /enviar arquivo/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /gravar consulta/i })).toBeInTheDocument()
  })

  it('modo padrão é Enviar arquivo (upload)', () => {
    renderStepAudio()
    expect(screen.getByRole('tab', { name: /enviar arquivo/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('clicar em Gravar consulta ativa a aba de gravação', () => {
    renderStepAudio()
    fireEvent.click(screen.getByRole('tab', { name: /gravar consulta/i }))
    expect(screen.getByRole('tab', { name: /gravar consulta/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('modo upload exibe área de drag-and-drop', () => {
    renderStepAudio()
    expect(screen.getByText(/arraste o arquivo aqui/i)).toBeInTheDocument()
  })

  it('modo gravação exibe botão Iniciar gravação', () => {
    renderStepAudio()
    fireEvent.click(screen.getByRole('tab', { name: /gravar consulta/i }))
    expect(screen.getByRole('button', { name: /iniciar gravação/i })).toBeInTheDocument()
  })
})

describe('StepAudio — iniciar gravação', () => {
  it('chama getUserMedia ao clicar em Iniciar gravação', async () => {
    const mockStream = makeMockStream()
    const getUserMedia = vi.fn().mockResolvedValue(mockStream)
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })

    renderStepAudio()
    await switchToRecordMode()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /iniciar gravação/i }))
    })

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
  })

  it('cria MediaRecorder com a stream obtida', async () => {
    const mockStream = makeMockStream()
    await renderStepAudio()
    await switchToRecordMode()
    await startRecording(mockStream)

    expect(MockMediaRecorder.instances[0].stream).toBe(mockStream)
  })

  it('exibe botões Pausar e Finalizar durante gravação', async () => {
    const mockStream = makeMockStream()
    renderStepAudio()
    await switchToRecordMode()
    await startRecording(mockStream)

    expect(screen.getByRole('button', { name: /pausar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /finalizar/i })).toBeInTheDocument()
  })

  it('exibe timer durante gravação', async () => {
    const mockStream = makeMockStream()
    renderStepAudio()
    await switchToRecordMode()
    await startRecording(mockStream)

    expect(screen.getByTestId('record-timer')).toBeInTheDocument()
  })

  it('mostra erro se getUserMedia for negado', async () => {
    const { toast } = await import('sonner')
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockRejectedValue(new Error('Permission denied')),
      },
    })

    renderStepAudio()
    await switchToRecordMode()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /iniciar gravação/i }))
    })

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringMatching(/microfone|permissão|acesso/i),
      )
    })
  })
})

describe('StepAudio — pausar gravação', () => {
  it('chama MediaRecorder.pause() ao clicar Pausar', async () => {
    const mockStream = makeMockStream()
    renderStepAudio()
    await switchToRecordMode()
    await startRecording(mockStream)

    fireEvent.click(screen.getByRole('button', { name: /pausar/i }))

    expect(MockMediaRecorder.instances[0].state).toBe('paused')
  })

  it('desativa a track do microfone ao pausar (track.enabled = false)', async () => {
    const track = makeMockTrack()
    const mockStream = makeMockStream(track)
    renderStepAudio()
    await switchToRecordMode()
    await startRecording(mockStream)

    fireEvent.click(screen.getByRole('button', { name: /pausar/i }))

    expect(track.enabled).toBe(false)
  })

  it('exibe botões Retomar e Finalizar enquanto pausado', async () => {
    const mockStream = makeMockStream()
    renderStepAudio()
    await switchToRecordMode()
    await startRecording(mockStream)

    fireEvent.click(screen.getByRole('button', { name: /pausar/i }))

    expect(screen.getByRole('button', { name: /retomar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /finalizar/i })).toBeInTheDocument()
  })

  it('exibe indicador visual de pausado', async () => {
    const mockStream = makeMockStream()
    renderStepAudio()
    await switchToRecordMode()
    await startRecording(mockStream)

    fireEvent.click(screen.getByRole('button', { name: /pausar/i }))

    expect(screen.getByTestId('record-paused-indicator')).toBeInTheDocument()
  })
})

describe('StepAudio — retomar gravação', () => {
  it('chama MediaRecorder.resume() ao clicar Retomar', async () => {
    const mockStream = makeMockStream()
    renderStepAudio()
    await switchToRecordMode()
    await startRecording(mockStream)

    fireEvent.click(screen.getByRole('button', { name: /pausar/i }))
    fireEvent.click(screen.getByRole('button', { name: /retomar/i }))

    expect(MockMediaRecorder.instances[0].state).toBe('recording')
  })

  it('reativa a track do microfone ao retomar (track.enabled = true)', async () => {
    const track = makeMockTrack()
    const mockStream = makeMockStream(track)
    renderStepAudio()
    await switchToRecordMode()
    await startRecording(mockStream)

    fireEvent.click(screen.getByRole('button', { name: /pausar/i }))
    expect(track.enabled).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: /retomar/i }))
    expect(track.enabled).toBe(true)
  })

  it('volta a exibir Pausar e Finalizar após retomar', async () => {
    const mockStream = makeMockStream()
    renderStepAudio()
    await switchToRecordMode()
    await startRecording(mockStream)

    fireEvent.click(screen.getByRole('button', { name: /pausar/i }))
    fireEvent.click(screen.getByRole('button', { name: /retomar/i }))

    expect(screen.getByRole('button', { name: /pausar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /finalizar/i })).toBeInTheDocument()
  })
})

describe('StepAudio — finalizar gravação', () => {
  it('chama MediaRecorder.stop() ao clicar Finalizar', async () => {
    const mockStream = makeMockStream()
    renderStepAudio()
    await switchToRecordMode()
    await startRecording(mockStream)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /finalizar/i }))
    })

    expect(MockMediaRecorder.instances[0].state).toBe('inactive')
  })

  it('chama track.stop() ao finalizar (libera microfone)', async () => {
    const track = makeMockTrack()
    const mockStream = makeMockStream(track)
    renderStepAudio()
    await switchToRecordMode()
    await startRecording(mockStream)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /finalizar/i }))
    })

    expect(track.stop).toHaveBeenCalled()
  })

  it('exibe botão Transcrever após finalizar gravação', async () => {
    const mockStream = makeMockStream()
    renderStepAudio()
    await switchToRecordMode()
    await startRecording(mockStream)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /finalizar/i }))
    })

    expect(screen.getByRole('button', { name: /transcrever/i })).toBeInTheDocument()
  })

  it('finalizar enquanto pausado também libera o microfone', async () => {
    const track = makeMockTrack()
    const mockStream = makeMockStream(track)
    renderStepAudio()
    await switchToRecordMode()
    await startRecording(mockStream)

    fireEvent.click(screen.getByRole('button', { name: /pausar/i }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /finalizar/i }))
    })

    expect(track.stop).toHaveBeenCalled()
  })
})

describe('StepAudio — transcrever gravação', () => {
  async function setupRecordedState() {
    const track = makeMockTrack()
    const mockStream = makeMockStream(track)
    renderStepAudio()
    await switchToRecordMode()
    await startRecording(mockStream)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /finalizar/i }))
    })

    return { track }
  }

  it('envia o blob gravado para /api/transcribe ao clicar Transcrever', async () => {
    await setupRecordedState()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /transcrever/i }))
    })

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        '/api/transcribe',
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  it('envia patientId no FormData junto com o blob', async () => {
    await setupRecordedState()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /transcrever/i }))
    })

    await waitFor(() => {
      const [, init] = vi.mocked(fetch).mock.calls[0]
      const body = (init as RequestInit).body as FormData
      expect(body.get('patientId')).toBe('p-1')
      expect(body.get('audio')).toBeInstanceOf(Blob)
    })
  })

  it('exibe textarea de transcrição após clicar Transcrever', async () => {
    await setupRecordedState()

    fireEvent.click(screen.getByRole('button', { name: /transcrever/i }))

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    }, { timeout: 3000 })
  })
})

describe('StepAudio — cleanup de segurança', () => {
  it('libera a track do microfone ao desmontar o componente durante gravação', async () => {
    const track = makeMockTrack()
    const mockStream = makeMockStream(track)
    const { unmount } = renderStepAudio()
    await switchToRecordMode()
    await startRecording(mockStream)

    act(() => { unmount() })

    expect(track.stop).toHaveBeenCalled()
  })

  it('libera a track ao desmontar mesmo quando pausado', async () => {
    const track = makeMockTrack()
    const mockStream = makeMockStream(track)
    const { unmount } = renderStepAudio()
    await switchToRecordMode()
    await startRecording(mockStream)

    fireEvent.click(screen.getByRole('button', { name: /pausar/i }))

    act(() => { unmount() })

    expect(track.stop).toHaveBeenCalled()
  })
})
