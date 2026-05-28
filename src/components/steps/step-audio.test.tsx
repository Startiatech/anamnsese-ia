import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { StepAudio } from './step-audio'
import type { InterruptionReason } from '@/hooks/use-recording-interruption'

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

// ── Controllable hook mocks ──────────────────────────────────────────────────

// These refs allow tests to trigger callbacks on demand without auto-firing.
let _triggerSilence: (() => void) | null = null
let _triggerSpeech: (() => void) | null = null
let _triggerInterrupt: ((r: InterruptionReason) => void) | null = null

vi.mock('@/hooks/use-wake-lock', () => ({
  useWakeLock: () => ({
    acquire: vi.fn().mockResolvedValue(undefined),
    release: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/hooks/use-silence-detection', () => ({
  useSilenceDetection: ({
    active,
    onSilence,
    onSpeech,
  }: {
    active: boolean
    onSilence: () => void
    onSpeech: () => void
  }) => {
    if (active) {
      _triggerSilence = onSilence
      _triggerSpeech = onSpeech
    } else {
      _triggerSilence = null
      _triggerSpeech = null
    }
  },
}))

vi.mock('@/hooks/use-recording-interruption', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/use-recording-interruption')>(
    '@/hooks/use-recording-interruption',
  )
  return {
    ...actual,
    useRecordingInterruption: ({
      active,
      onInterrupt,
    }: {
      active: boolean
      onInterrupt: (r: InterruptionReason) => void
    }) => {
      if (active) {
        _triggerInterrupt = onInterrupt
      } else {
        _triggerInterrupt = null
      }
    },
  }
})

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
  _triggerSilence = null
  _triggerSpeech = null
  _triggerInterrupt = null
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.stubGlobal('MediaRecorder', MockMediaRecorder)
  vi.stubGlobal('fetch', vi.fn(() => makeStreamResponse('Paciente relata dor de cabeça.')))
})

afterEach(() => {
  vi.useRealTimers()
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
  // Avança o countdown 3..2..1 (3s) para o MediaRecorder ser criado
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000)
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

describe('StepAudio — margem de espera (requesting + preparing)', () => {
  it('exibe estado "Solicitando acesso ao microfone" enquanto getUserMedia está pendente', async () => {
    let resolveStream: (s: MediaStream) => void = () => {}
    const pending = new Promise<MediaStream>(resolve => { resolveStream = resolve })
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockReturnValue(pending) } })

    renderStepAudio()
    await switchToRecordMode()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /iniciar gravação/i }))
    })

    expect(screen.getByText(/solicitando acesso ao microfone/i)).toBeInTheDocument()

    // limpa: resolve para não vazar a promise
    await act(async () => { resolveStream(makeMockStream()) })
  })

  it('exibe countdown 3..2..1 após permissão concedida e antes de gravar', async () => {
    const mockStream = makeMockStream()
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(mockStream) } })

    renderStepAudio()
    await switchToRecordMode()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /iniciar gravação/i }))
    })

    expect(screen.getByTestId('record-countdown')).toHaveTextContent('3')
    expect(MockMediaRecorder.instances).toHaveLength(0)

    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(screen.getByTestId('record-countdown')).toHaveTextContent('2')

    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(screen.getByTestId('record-countdown')).toHaveTextContent('1')

    expect(MockMediaRecorder.instances).toHaveLength(0)
  })

  it('cria o MediaRecorder somente após o countdown terminar', async () => {
    const mockStream = makeMockStream()
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(mockStream) } })

    renderStepAudio()
    await switchToRecordMode()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /iniciar gravação/i }))
    })

    expect(MockMediaRecorder.instances).toHaveLength(0)

    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })

    expect(MockMediaRecorder.instances).toHaveLength(1)
  })

  it('mostra mensagem específica para NotAllowedError', async () => {
    const { toast } = await import('sonner')
    const err = new DOMException('Permission denied', 'NotAllowedError')
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(err) } })

    renderStepAudio()
    await switchToRecordMode()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /iniciar gravação/i }))
    })

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/permissão negada|habilite o microfone/i))
    })
  })

  it('mostra mensagem específica para NotFoundError', async () => {
    const { toast } = await import('sonner')
    const err = new DOMException('No device', 'NotFoundError')
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(err) } })

    renderStepAudio()
    await switchToRecordMode()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /iniciar gravação/i }))
    })

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/nenhum microfone detectado/i))
    })
  })

  it('volta ao estado idle (botão Iniciar gravação visível) após erro', async () => {
    const err = new DOMException('Permission denied', 'NotAllowedError')
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(err) } })

    renderStepAudio()
    await switchToRecordMode()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /iniciar gravação/i }))
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /iniciar gravação/i })).toBeInTheDocument()
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

describe('StepAudio — VAD auto-pausa, wake lock e interrupção', () => {
  it('exibe indicador de silêncio quando onSilence é disparado durante gravação', async () => {
    const mockStream = makeMockStream()
    renderStepAudio()
    await switchToRecordMode()
    await startRecording(mockStream)

    // Dispara o callback de silêncio
    await act(async () => {
      _triggerSilence?.()
    })

    expect(await screen.findByText(/pausado automaticamente/i)).toBeInTheDocument()
  })

  it('exibe alerta de interrupção com mensagem e texto de preservação', async () => {
    const mockStream = makeMockStream()
    renderStepAudio()
    await switchToRecordMode()
    await startRecording(mockStream)

    // Avança 5s durante a gravação para que o snapshot seja > 00:00
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })

    // Dispara o callback de interrupção (suspended)
    await act(async () => {
      _triggerInterrupt?.('suspended')
    })

    const alert = await screen.findByTestId('interruption-alert')
    expect(alert).toHaveTextContent(/o computador entrou em suspensão/i)
    expect(alert).toHaveTextContent(/foi preservado/i)
    // The preserved time must not be 00:00 — the snapshot was taken after 5s of recording
    expect(alert).not.toHaveTextContent('00:00')
  })

  it('envia os dois segmentos separadamente (sem concatenar bytes) ao transcrever', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('texto\n__DONE__\n', { status: 200 }),
    )

    const mockStream = makeMockStream()
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(mockStream) } })
    renderStepAudio()
    await switchToRecordMode()

    // Segmento 1
    await startRecording(mockStream)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /finalizar/i }))
    })

    // Após finalizar, estado é 'recorded' — "Continuar gravando" vai direto pedir o mic
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continuar gravando/i })).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /continuar gravando/i }))
    })

    // Segmento 2: já entrou em requesting/preparing — só avança o countdown
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    await waitFor(() => expect(MockMediaRecorder.instances).toHaveLength(2))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /finalizar/i }))
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /transcrever/i })).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /transcrever/i }))
    })

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled()
    })

    const sentInit = fetchSpy.mock.calls[0][1] as RequestInit
    const sentForm = sentInit.body as FormData
    const audios = sentForm.getAll('audio')
    expect(audios).toHaveLength(2)
    audios.forEach((a) => expect((a as File).size).toBeGreaterThan(0))
    expect(MockMediaRecorder.instances.length).toBe(2)
  })

  it('preserva o segmento gravado se o microfone falhar ao "Continuar gravando"', async () => {
    const mockStream = makeMockStream()
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(mockStream) } })
    renderStepAudio()
    await switchToRecordMode()

    // Segmento 1
    await startRecording(mockStream)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /finalizar/i }))
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continuar gravando/i })).toBeInTheDocument()
    })

    // Agora o mic falha na tentativa de continuar
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(new DOMException('No device', 'NotFoundError')) },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /continuar gravando/i }))
    })

    // Volta para 'recorded': Transcrever continua disponível para o trecho já capturado
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /transcrever/i })).toBeInTheDocument()
    })
  })

  it('permite pausa manual "dura" durante a auto-pausa do VAD', async () => {
    const mockStream = makeMockStream()
    renderStepAudio()
    await switchToRecordMode()
    await startRecording(mockStream)

    await act(async () => { _triggerSilence?.() })
    expect(await screen.findByText(/pausado automaticamente/i)).toBeInTheDocument()

    // Clicar "Pausar" durante a auto-pausa consolida em pausa manual (estado 'paused')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /pausar/i }))
    })

    expect(screen.getByTestId('record-paused-indicator')).toBeInTheDocument()
    // VAD desativado: indicador de auto-pausa some
    expect(screen.queryByText(/pausado automaticamente/i)).not.toBeInTheDocument()
  })

  it('acumula a duração de todos os segmentos no tempo preservado da interrupção', async () => {
    const mockStream = makeMockStream()
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(mockStream) } })
    renderStepAudio()
    await switchToRecordMode()

    // Segmento 1: ~4s gravados
    await startRecording(mockStream)
    await act(async () => { await vi.advanceTimersByTimeAsync(4000) })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /finalizar/i }))
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continuar gravando/i })).toBeInTheDocument()
    })

    // Segmento 2: continuar + ~3s gravados
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /continuar gravando/i }))
    })
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    await waitFor(() => expect(MockMediaRecorder.instances).toHaveLength(2))
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })

    // Interrupção: tempo preservado deve refletir 4s + 3s (> só os 3s do segmento atual)
    await act(async () => { _triggerInterrupt?.('suspended') })

    const alert = await screen.findByTestId('interruption-alert')
    expect(alert).toHaveTextContent(/00:0[4-9]/)
  })

  it('retoma automaticamente quando a voz volta apos silencio', async () => {
    const mockStream = makeMockStream()
    renderStepAudio()
    await switchToRecordMode()
    await startRecording(mockStream)

    await act(async () => { _triggerSilence?.() })
    expect(await screen.findByText(/pausado automaticamente/i)).toBeInTheDocument()

    await act(async () => { _triggerSpeech?.() })
    await waitFor(() => {
      expect(screen.queryByText(/pausado automaticamente/i)).not.toBeInTheDocument()
    })
  })
})
