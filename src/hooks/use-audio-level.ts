import { useEffect, useRef } from 'react'

interface UseAudioLevelArgs {
  stream: MediaStream | null
  active: boolean // mede só quando true; para o AudioContext quando false
  onLevel: (level: number) => void // chamado a cada 100ms com o nível 0..1
}

const POLL_INTERVAL_MS = 100

/**
 * Lê o volume (RMS normalizado 0..1) da stream do microfone e reporta via onLevel.
 * Responsabilidade única: medir nível para feedback visual. Não decide silêncio
 * (isso é do useSilenceDetection) nem grava (isso é do MediaRecorder).
 */
export function useAudioLevel({ stream, active, onLevel }: UseAudioLevelArgs) {
  const onLevelRef = useRef(onLevel)
  onLevelRef.current = onLevel

  useEffect(() => {
    if (!active || !stream) return
    if (typeof AudioContext === 'undefined') return // degradação graciosa

    const ctx = new AudioContext()
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    source.connect(analyser)

    const data = new Uint8Array(analyser.frequencyBinCount)

    const interval = setInterval(() => {
      analyser.getByteTimeDomainData(data)
      let sumSq = 0
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128
        sumSq += v * v
      }
      const rms = Math.sqrt(sumSq / data.length)
      onLevelRef.current(rms)
    }, POLL_INTERVAL_MS)

    return () => {
      clearInterval(interval)
      source.disconnect()
      analyser.disconnect()
      void ctx.close()
    }
  }, [stream, active])
}
