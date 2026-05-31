'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useConsultationFlow } from '@/context/consultation-context'
import { StepContentBox } from '@/components/steps/step-content-box'
import { toast } from 'sonner'
import { API } from '@/lib/routes'
import { useSilenceDetection } from '@/hooks/use-silence-detection'
import { useWakeLock } from '@/hooks/use-wake-lock'
import {
  useRecordingInterruption,
  INTERRUPTION_MESSAGES,
  type InterruptionReason,
} from '@/hooks/use-recording-interruption'
import { useAudioLevel } from '@/hooks/use-audio-level'
import { AudioWaveform, type WaveformVariant } from '@/components/steps/audio-waveform'

const TYPEWRITER_INTERVAL_MS = 30
const ACCEPTED_FORMATS = '.mp3,.wav,.m4a,.ogg'
const COUNTDOWN_SECONDS = 3
const COUNTDOWN_INTERVAL_MS = 1000
// VAD: silêncio = RMS abaixo de 5% da escala por 2,5s contínuos antes de auto-pausar.
const SILENCE_THRESHOLD = 0.05
const SILENCE_MS = 2500

type InputMode = 'upload' | 'record'
type RecordState = 'idle' | 'requesting' | 'preparing' | 'recording' | 'paused' | 'recorded'
type AudioState = 'idle' | 'streaming' | 'done' | 'quota_exceeded'

interface StepAudioProps {
  patientId: string
  audioAttemptsUsed: number
  initialTranscript: string
  onTranscriptionComplete: () => void
}

export function StepAudio({
  patientId,
  audioAttemptsUsed,
  initialTranscript,
  onTranscriptionComplete,
}: StepAudioProps) {
  const { nextStep, setRawTranscript, audioAttemptsLimit, setIsTranscribing } = useConsultationFlow()

  const quotaExceeded = audioAttemptsLimit !== null && audioAttemptsUsed >= audioAttemptsLimit

  const [audioState, setAudioState] = useState<AudioState>(
    initialTranscript ? 'done' : quotaExceeded ? 'quota_exceeded' : 'idle'
  )
  const [inputMode, setInputMode] = useState<InputMode>('upload')
  const [recordState, setRecordState] = useState<RecordState>('idle')
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const [autoPaused, setAutoPaused] = useState(false)
  const [interruption, setInterruption] = useState<InterruptionReason | null>(null)
  const [savedElapsedMs, setSavedElapsedMs] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)

  const [file, setFile] = useState<File | null>(null)
  const [partialTranscript, setPartialTranscript] = useState(initialTranscript)
  const [displayedText, setDisplayedText] = useState(initialTranscript)

  const wordQueueRef = useRef<string[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastWordCountRef = useRef(
    initialTranscript ? initialTranscript.split(' ').length : 0
  )
  const pendingDoneRef = useRef(false)
  const toastIdRef = useRef<string | number | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Gravação
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const segmentsRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedStartRef = useRef<number | null>(null)
  const accumulatedMsRef = useRef(0)
  // Soma das durações dos segmentos já finalizados (o timer visível zera por segmento).
  const segmentsTotalMsRef = useRef(0)

  // ── Hooks de gravação ─────────────────────────────────────────────────────
  const { acquire: acquireWakeLock, release: releaseWakeLock } = useWakeLock()

  const isRecordingActive = recordState === 'recording' || recordState === 'paused'

  const waveformVariant: WaveformVariant =
    recordState === 'paused' ? 'paused' : autoPaused ? 'silence' : 'recording'

  // mediaStreamRef.current já está populado quando recordState vira 'recording'
  // (setado em beginRecording antes do setRecordState), então o stream passado aos
  // hooks é o stream vivo no render em que `active` fica true. O guard interno dos
  // hooks (!active || !stream) cobre o estado transitório.
  useAudioLevel({
    stream: mediaStreamRef.current,
    active: isRecordingActive,
    onLevel: setAudioLevel,
  })

  useSilenceDetection({
    stream: mediaStreamRef.current,
    active: recordState === 'recording',
    silenceMs: SILENCE_MS,
    threshold: SILENCE_THRESHOLD,
    onSilence: () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.pause()
        pauseTimer()
        setAutoPaused(true)
      }
    },
    // VAD auto-resumes on detected speech (ambient sound can resume an auto-paused recording — intentional hybrid behavior; manual "Pausar" stays available for hard pauses).
    onSpeech: () => {
      if (mediaRecorderRef.current?.state === 'paused') {
        mediaRecorderRef.current.resume()
        startTimer()
        setAutoPaused(false)
      }
    },
  })

  useRecordingInterruption({
    stream: mediaStreamRef.current,
    active: isRecordingActive,
    onInterrupt: (reason) => {
      // Snapshot do tempo total preservado: segmentos anteriores + segmento atual.
      const elapsedSnapshot =
        segmentsTotalMsRef.current +
        accumulatedMsRef.current +
        (elapsedStartRef.current !== null ? Date.now() - elapsedStartRef.current : 0)
      setSavedElapsedMs(elapsedSnapshot)
      setInterruption(reason)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop() // onstop preserves the segment
      }
      pauseTimer()
    },
  })

  // Cleanup do microfone ao desmontar
  useEffect(() => {
    return () => {
      stopMicrophoneTrack()
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  useEffect(() => {
    if (audioState === 'streaming' && textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight
    }
  }, [displayedText, audioState])

  useEffect(() => {
    if (initialTranscript) {
      setRawTranscript(initialTranscript)
    }
  }, [initialTranscript, setRawTranscript])

  function stopMicrophoneTrack() {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop())
      mediaStreamRef.current = null
    }
  }

  function startTimer() {
    elapsedStartRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setElapsedMs(accumulatedMsRef.current + (Date.now() - (elapsedStartRef.current ?? Date.now())))
    }, 200)
  }

  function pauseTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (elapsedStartRef.current !== null) {
      accumulatedMsRef.current += Date.now() - elapsedStartRef.current
      elapsedStartRef.current = null
    }
  }

  function resetTimer() {
    pauseTimer()
    accumulatedMsRef.current = 0
    setElapsedMs(0)
  }

  function formatTimer(ms: number) {
    const totalSec = Math.floor(ms / 1000)
    const m = Math.floor(totalSec / 60).toString().padStart(2, '0')
    const s = (totalSec % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  async function handleStartRecording() {
    setRecordState('requesting')

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      // Se já existem segmentos gravados (ex.: "Continuar gravando" e o mic falhou),
      // volta para 'recorded' para o trecho anterior continuar transcritível — nunca
      // descartar áudio já capturado. Sem segmentos, volta para 'idle'.
      setRecordState(segmentsRef.current.length > 0 ? 'recorded' : 'idle')
      const name = err instanceof DOMException ? err.name : ''
      if (name === 'NotAllowedError') {
        toast.error('Permissão negada. Habilite o microfone nas configurações do navegador.')
      } else if (name === 'NotFoundError') {
        toast.error('Nenhum microfone detectado neste dispositivo.')
      } else {
        toast.error('Não foi possível acessar o microfone. Verifique as permissões.')
      }
      return
    }

    mediaStreamRef.current = stream
    setCountdown(COUNTDOWN_SECONDS)
    setRecordState('preparing')

    let remaining = COUNTDOWN_SECONDS
    countdownRef.current = setInterval(() => {
      remaining -= 1
      if (remaining <= 0) {
        if (countdownRef.current) {
          clearInterval(countdownRef.current)
          countdownRef.current = null
        }
        beginRecording(stream)
      } else {
        setCountdown(remaining)
      }
    }, COUNTDOWN_INTERVAL_MS)
  }

  function beginRecording(stream: MediaStream) {
    chunksRef.current = []
    const recorder = new MediaRecorder(stream)
    mediaRecorderRef.current = recorder

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      const segment = new Blob(chunksRef.current, { type: 'audio/webm' })
      if (segment.size > 0) segmentsRef.current.push(segment)
      // Cada segmento é um WebM válido próprio; NÃO concatenamos os bytes (container
      // inválido). recordedBlob guarda só o último trecho como marcador para a UI —
      // a transcrição envia todos os segmentos (segmentsRef) separadamente.
      const latest = segmentsRef.current[segmentsRef.current.length - 1] ?? null
      setRecordedBlob(latest)
      setRecordState('recorded')
      stopMicrophoneTrack()
      // Soma a duração deste segmento ao total antes de zerar o timer do segmento.
      segmentsTotalMsRef.current +=
        accumulatedMsRef.current +
        (elapsedStartRef.current !== null ? Date.now() - elapsedStartRef.current : 0)
      resetTimer()
      void releaseWakeLock()
    }

    recorder.start(1000)
    void acquireWakeLock()
    setAutoPaused(false)
    setInterruption(null)
    setSavedElapsedMs(0)
    startTimer()
    setRecordState('recording')
  }

  function handleContinueRecording() {
    // Não descarta recordedBlob/segmentsRef: vai direto pedir o microfone e anexar um
    // novo segmento. Se a captura falhar, handleStartRecording restaura 'recorded'.
    void handleStartRecording()
  }

  function handlePauseRecording() {
    if (!mediaRecorderRef.current || !mediaStreamRef.current) return
    const recorder = mediaRecorderRef.current
    if (recorder.state === 'inactive') return
    // Pausa manual "dura": funciona tanto em gravação ativa quanto durante uma
    // auto-pausa do VAD (recorder já 'paused', mas recordState ainda 'recording').
    // Consolidar em 'paused' desativa o VAD (active = recordState === 'recording'),
    // impedindo que ruído ambiente retome a gravação.
    if (recorder.state === 'recording') {
      recorder.pause()
      pauseTimer()
    }
    mediaStreamRef.current.getTracks().forEach(t => { t.enabled = false })
    setAutoPaused(false)
    setRecordState('paused')
  }

  function handleResumeRecording() {
    if (!mediaRecorderRef.current || !mediaStreamRef.current) return
    if (mediaRecorderRef.current.state !== 'paused') return
    mediaStreamRef.current.getTracks().forEach(t => { t.enabled = true })
    mediaRecorderRef.current.resume()
    startTimer()
    setRecordState('recording')
  }

  function handleStopRecording() {
    if (!mediaRecorderRef.current) return
    // onstop cuida de liberar a stream e atualizar o estado
    mediaRecorderRef.current.stop()
    pauseTimer()
  }

  // ── Upload de arquivo ──────────────────────────────────────────────────────

  function handleFile(selected: File) {
    setFile(selected)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFile(dropped)
  }

  function handleReset() {
    segmentsRef.current = []
    segmentsTotalMsRef.current = 0
    setFile(null)
    setRecordedBlob(null)
    setRecordState('idle')
    setPartialTranscript('')
    setAudioState('idle')
    wordQueueRef.current = []
    pendingDoneRef.current = false
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setDisplayedText('')
    lastWordCountRef.current = 0
    setSavedElapsedMs(0)
    resetTimer()
  }

  // ── Typewriter ─────────────────────────────────────────────────────────────

  function startTypewriter() {
    if (intervalRef.current) return
    intervalRef.current = setInterval(() => {
      const word = wordQueueRef.current.shift()
      if (word === undefined) {
        clearInterval(intervalRef.current!)
        intervalRef.current = null
        if (pendingDoneRef.current) {
          pendingDoneRef.current = false
          toast.dismiss(toastIdRef.current)
          toast.success('Transcrição concluída!')
          setAudioState('done')
          onTranscriptionComplete()
        }
        return
      }
      setDisplayedText(prev => (prev ? prev + ' ' + word : word))
    }, TYPEWRITER_INTERVAL_MS)
  }

  // ── Transcrição (shared) ───────────────────────────────────────────────────

  const handleProcess = useCallback(async (audioSource: File | Blob[]) => {
    setAudioState('streaming')

    const formData = new FormData()
    // Upload de arquivo: um único File. Gravação: lista de segmentos WebM válidos —
    // cada um vai como 'audio' separado para transcrição independente no servidor.
    const sources = Array.isArray(audioSource) ? audioSource : [audioSource]
    sources.forEach((src, i) => {
      const name = src instanceof File ? src.name : `recording-${i}.webm`
      formData.append('audio', src, name)
    })
    formData.append('patientId', patientId)

    toastIdRef.current = toast.loading('Aguarde...')

    try {
      const response = await fetch(API.transcribe, { method: 'POST', body: formData })

      if (!response.ok) {
        const data = await response.json() as { error?: string }
        throw new Error(data.error ?? 'Erro na transcrição.')
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        if (text.includes('__ERROR__:')) {
          const msg = text.replace('__ERROR__:', '').replace('__DONE__', '').trim()
          throw new Error(msg)
        }
        const clean = text.replace('__DONE__', '').replace(/\n$/, '').trim()
        if (clean) {
          full += (full ? ' ' : '') + clean
          setPartialTranscript(full)
          const allWords = full.split(/\s+/).filter(Boolean)
          const newWords = allWords.slice(lastWordCountRef.current)
          lastWordCountRef.current = allWords.length
          wordQueueRef.current.push(...newWords)
          startTypewriter()
        }
        if (text.includes('__DONE__')) break
      }

      setRawTranscript(full)
      if (wordQueueRef.current.length === 0) {
        toast.dismiss(toastIdRef.current)
        toast.success('Transcrição concluída!')
        setAudioState('done')
        onTranscriptionComplete()
      } else {
        pendingDoneRef.current = true
      }
    } catch (err) {
      toast.dismiss(toastIdRef.current)
      toast.error(err instanceof Error ? err.message : 'Erro inesperado.')
      wordQueueRef.current = []
      pendingDoneRef.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      setDisplayedText('')
      lastWordCountRef.current = 0
      setAudioState('idle')
    }
  }, [patientId, setRawTranscript, onTranscriptionComplete])

  const canRetry = audioAttemptsLimit === null || audioAttemptsUsed < audioAttemptsLimit

  const isTranscribing = audioState === 'streaming' || audioState === 'done'

  useEffect(() => {
    setIsTranscribing(audioState === 'streaming')
    return () => setIsTranscribing(false)
  }, [audioState, setIsTranscribing])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col md:flex-row md:gap-8 md:items-start">
      {/* Coluna principal */}
      <div className="flex-1 min-w-0 space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Áudio da Consulta</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Envie ou grave o áudio para transcrição automática via IA.</p>
        </div>

        {audioState === 'quota_exceeded' && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">
              Você utilizou todas as {audioAttemptsLimit} tentativas de envio disponíveis no seu plano.
            </p>
            {partialTranscript && (
              <Button className="mt-3" onClick={nextStep}>
                Continuar com última transcrição
              </Button>
            )}
          </div>
        )}

        {/* Abas de modo — ocultas durante transcrição */}
        {!isTranscribing && audioState !== 'quota_exceeded' && (
          <div role="tablist" className="flex gap-1 rounded-lg border border-border p-1 w-full sm:w-fit">
            <button
              role="tab"
              aria-selected={inputMode === 'upload'}
              onClick={() => setInputMode('upload')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                inputMode === 'upload'
                  ? 'bg-violet-500 text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Enviar arquivo
            </button>
            <button
              role="tab"
              aria-selected={inputMode === 'record'}
              onClick={() => setInputMode('record')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                inputMode === 'record'
                  ? 'bg-violet-500 text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Gravar consulta
            </button>
          </div>
        )}

        {/* ── Modo upload ── */}
        {inputMode === 'upload' && audioState === 'idle' && (
          <>
            <StepContentBox
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
              className="cursor-pointer rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary hover:bg-secondary hover:text-foreground flex flex-col items-center justify-center"
            >
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED_FORMATS}
                className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              {file ? (
                <div className="space-y-1">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  <p className="text-xs text-primary">Clique para trocar o arquivo</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-muted-foreground">Arraste o arquivo aqui ou clique para selecionar</p>
                  <p className="text-sm text-muted-foreground">Formatos: MP3, WAV, M4A, OGG</p>
                </div>
              )}
            </StepContentBox>
            <Button className="w-full sm:w-auto" onClick={() => file && handleProcess(file)} disabled={!file}>
              Iniciar Processamento
            </Button>
          </>
        )}

        {/* ── Modo gravação ── */}
        {inputMode === 'record' && audioState === 'idle' && (
          <div className="space-y-4">
            {/* Idle: botão iniciar */}
            {recordState === 'idle' && (
              <Button className="w-full sm:w-auto" onClick={handleStartRecording}>
                Iniciar gravação
              </Button>
            )}

            {/* Requesting: aguardando prompt do navegador */}
            {recordState === 'requesting' && (
              <div className="flex items-center gap-3" data-testid="record-requesting">
                <span className="inline-block h-3 w-3 rounded-full bg-primary animate-pulse" />
                <span className="text-sm text-muted-foreground">Solicitando acesso ao microfone...</span>
              </div>
            )}

            {/* Preparing: countdown 3..2..1 */}
            {recordState === 'preparing' && (
              <div className="flex flex-col items-start gap-2">
                <span
                  data-testid="record-countdown"
                  className="font-mono text-5xl font-bold tabular-nums text-primary"
                >
                  {countdown}
                </span>
                <span className="text-sm text-muted-foreground">Prepare-se para gravar...</span>
              </div>
            )}

            {/* Recording */}
            {recordState === 'recording' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="inline-block h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                  <span
                    data-testid="record-timer"
                    className="font-mono text-lg font-semibold tabular-nums"
                  >
                    {formatTimer(elapsedMs)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {autoPaused ? '⏸ Silêncio detectado — pausado automaticamente' : 'Gravando...'}
                  </span>
                </div>
                <AudioWaveform level={audioLevel} variant={waveformVariant} />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handlePauseRecording}>
                    Pausar
                  </Button>
                  <Button variant="destructive" onClick={handleStopRecording}>
                    Finalizar
                  </Button>
                </div>
              </div>
            )}

            {/* Paused */}
            {recordState === 'paused' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span
                    data-testid="record-paused-indicator"
                    className="inline-block h-3 w-3 rounded-full bg-yellow-400"
                  />
                  <span
                    data-testid="record-timer"
                    className="font-mono text-lg font-semibold tabular-nums"
                  >
                    {formatTimer(elapsedMs)}
                  </span>
                  <span className="text-sm text-muted-foreground">Pausado</span>
                </div>
                <AudioWaveform level={audioLevel} variant="paused" />
                <div className="flex gap-2">
                  <Button onClick={handleResumeRecording}>
                    Retomar
                  </Button>
                  <Button variant="destructive" onClick={handleStopRecording}>
                    Finalizar
                  </Button>
                </div>
              </div>
            )}

            {/* Recorded: aguardando transcrição */}
            {recordState === 'recorded' && recordedBlob && (
              <div className="space-y-3">
                {interruption && (
                  <div
                    data-testid="interruption-alert"
                    className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive"
                  >
                    A gravação foi interrompida porque {INTERRUPTION_MESSAGES[interruption].toLowerCase()}.
                    O áudio até {formatTimer(savedElapsedMs)} foi preservado. Continue gravando para anexar
                    um novo trecho ou transcreva o que já foi capturado.
                  </div>
                )}
                {!interruption && (
                  <p className="text-sm text-muted-foreground">
                    Gravação concluída. Clique em Transcrever para processar o áudio.
                  </p>
                )}
                <div className="flex gap-2">
                  <Button onClick={() => handleProcess(segmentsRef.current)}>
                    Transcrever
                  </Button>
                  <Button variant="outline" onClick={handleContinueRecording}>
                    Continuar gravando
                  </Button>
                  <Button variant="outline" onClick={handleReset}>
                    Regravar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Resultado da transcrição (upload e gravação) ── */}
        {(audioState === 'streaming' || audioState === 'done') && (
          <div className="space-y-3">
            <Textarea
              ref={textareaRef}
              readOnly
              value={displayedText}
              className="resize-none font-mono text-sm min-h-[26rem] w-full"
              placeholder="Transcrição aparecerá aqui..."
            />
            {audioState === 'streaming' && (
              <p className="text-xs text-muted-foreground animate-pulse">Processando áudio...</p>
            )}
            {audioState === 'done' && (
              <div className="flex gap-2">
                <Button onClick={nextStep}>Continuar</Button>
                {canRetry && (
                  <Button variant="outline" onClick={handleReset}>
                    {inputMode === 'record' ? 'Regravar' : 'Trocar áudio'}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Painel contextual */}
      <div className="w-full md:w-72 shrink-0 space-y-4 mt-6 md:mt-0 md:sticky md:top-4">
        {/* Cota de tentativas */}
        <div className="rounded-xl border border-primary/15 p-5 space-y-3 bg-primary/[0.04]">
          <p className="text-xs font-bold uppercase tracking-widest text-highlight">Cota de envios</p>
          {audioAttemptsLimit !== null ? (
            <>
              <div className="flex items-end gap-1">
                <span className="text-2xl font-bold text-foreground">{audioAttemptsUsed}</span>
                <span className="text-sm text-muted-foreground mb-0.5">/ {audioAttemptsLimit} usados</span>
              </div>
              <div className="w-full rounded-full h-1.5 bg-white/10">
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (audioAttemptsUsed / audioAttemptsLimit) * 100)}%`,
                    background: audioAttemptsUsed >= audioAttemptsLimit
                      ? 'rgb(239,68,68)'
                      : 'var(--gradient-brand)',
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {audioAttemptsLimit - audioAttemptsUsed > 0
                  ? `${audioAttemptsLimit - audioAttemptsUsed} envio${audioAttemptsLimit - audioAttemptsUsed !== 1 ? 's' : ''} restante${audioAttemptsLimit - audioAttemptsUsed !== 1 ? 's' : ''}`
                  : 'Limite atingido'}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Envios ilimitados no seu plano.</p>
          )}
        </div>

        {/* Dicas */}
        <div className="rounded-xl border border-border p-5 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Dicas de gravação</p>
          <ul className="space-y-2">
            {[
              'Grave em ambiente silencioso',
              'Fale claramente e em ritmo normal',
              'Evite música ou ruído de fundo',
              'Arquivos de até 100 MB são aceitos (≈ 60 min de consulta)',
            ].map(tip => (
              <li key={tip} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
