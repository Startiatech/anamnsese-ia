import { useEffect, useRef } from 'react'

export type InterruptionReason = 'suspended' | 'mic-disconnected'

// Watchdog: a cada tick medimos o intervalo real entre ticks. Durante suspensão/
// hibernação o event loop congela, então no "acordar" o gap fica muito maior que o
// esperado — sinal confiável (cross-platform) de que o sistema dormiu. Diferente de
// um evento "hidden", que durante a hibernação fica antigo demais (o relógio avança
// enquanto o JS está congelado) e por isso não serve para classificar a interrupção.
const WATCHDOG_INTERVAL_MS = 2000
const SUSPEND_GAP_MS = 10000
// Janela após o "acordar" em que um 'ended' da track é atribuído à suspensão.
const RESUME_WINDOW_MS = 5000

interface UseRecordingInterruptionArgs {
  stream: MediaStream | null
  active: boolean
  onInterrupt: (reason: InterruptionReason) => void
}

export const INTERRUPTION_MESSAGES: Record<InterruptionReason, string> = {
  suspended: 'O computador entrou em suspensão',
  'mic-disconnected': 'O microfone foi desconectado',
}

export function useRecordingInterruption({
  stream,
  active,
  onInterrupt,
}: UseRecordingInterruptionArgs) {
  const suspendDetectedAtRef = useRef<number | null>(null)
  const onInterruptRef = useRef(onInterrupt)
  onInterruptRef.current = onInterrupt

  useEffect(() => {
    if (!active || !stream) return
    const track = stream.getAudioTracks()[0]
    if (!track) return
    suspendDetectedAtRef.current = null

    let lastTick = Date.now()
    const watchdog = setInterval(() => {
      const now = Date.now()
      if (now - lastTick > SUSPEND_GAP_MS) {
        suspendDetectedAtRef.current = now
      }
      lastTick = now
    }, WATCHDOG_INTERVAL_MS)

    const onEnded = () => {
      const now = Date.now()
      // Cobre as duas ordens possíveis no "acordar": se o watchdog ainda não rodou,
      // o gap desde o último tick já denuncia o congelamento; se já rodou, usamos a
      // marca recente. Fora disso, a track terminou por desconexão do microfone.
      const suspended =
        now - lastTick > SUSPEND_GAP_MS ||
        (suspendDetectedAtRef.current !== null &&
          now - suspendDetectedAtRef.current < RESUME_WINDOW_MS)
      onInterruptRef.current(suspended ? 'suspended' : 'mic-disconnected')
    }

    track.addEventListener('ended', onEnded)

    return () => {
      clearInterval(watchdog)
      track.removeEventListener('ended', onEnded)
    }
  }, [stream, active])
}
