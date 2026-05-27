import { useEffect, useRef } from 'react'

export type InterruptionReason = 'suspended' | 'mic-disconnected' | 'backgrounded'

// Janela em que um evento "hidden" recente indica suspensao do sistema.
const RECENT_HIDDEN_WINDOW_MS = 4000

interface UseRecordingInterruptionArgs {
  stream: MediaStream | null
  active: boolean
  onInterrupt: (reason: InterruptionReason) => void
}

export const INTERRUPTION_MESSAGES: Record<InterruptionReason, string> = {
  suspended: 'O computador entrou em suspensão',
  'mic-disconnected': 'O microfone foi desconectado',
  backgrounded: 'O app ficou em segundo plano',
}

export function useRecordingInterruption({
  stream,
  active,
  onInterrupt,
}: UseRecordingInterruptionArgs) {
  const lastHiddenAtRef = useRef<number | null>(null)
  const onInterruptRef = useRef(onInterrupt)
  onInterruptRef.current = onInterrupt

  useEffect(() => {
    if (!active || !stream) return
    const track = stream.getAudioTracks()[0]
    if (!track) return

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenAtRef.current = Date.now()
      }
    }

    const onEnded = () => {
      const hiddenRecently =
        lastHiddenAtRef.current !== null &&
        Date.now() - lastHiddenAtRef.current < RECENT_HIDDEN_WINDOW_MS
      onInterruptRef.current(hiddenRecently ? 'suspended' : 'mic-disconnected')
    }

    document.addEventListener('visibilitychange', onVisibility)
    track.addEventListener('ended', onEnded)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      track.removeEventListener('ended', onEnded)
    }
  }, [stream, active])
}
