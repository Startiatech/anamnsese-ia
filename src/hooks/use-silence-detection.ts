import { useEffect, useRef } from 'react'

interface UseSilenceDetectionArgs {
  stream: MediaStream | null
  active: boolean
  silenceMs: number
  threshold: number // 0..1 (fração da escala)
  onSilence: () => void
  onSpeech: () => void
}

const POLL_INTERVAL_MS = 200

export function useSilenceDetection({
  stream,
  active,
  silenceMs,
  threshold,
  onSilence,
  onSpeech,
}: UseSilenceDetectionArgs) {
  const silentSinceRef = useRef<number | null>(null)
  const inSilenceRef = useRef(false)

  // Mantém callbacks atualizados sem reiniciar o efeito.
  const onSilenceRef = useRef(onSilence)
  const onSpeechRef = useRef(onSpeech)
  onSilenceRef.current = onSilence
  onSpeechRef.current = onSpeech

  useEffect(() => {
    if (!active || !stream) return
    if (typeof AudioContext === 'undefined') return // degradação graciosa

    const ctx = new AudioContext()
    // Política de autoplay do Chrome: um AudioContext criado fora de um gesto
    // direto (aqui, após o countdown via setTimeout) pode nascer 'suspended' e
    // não processar áudio. Sem isto, o analisador lê sempre silêncio: onSilence
    // dispara mas onSpeech nunca, e a gravação não retoma ao voltar a falar.
    // A ativação fixa da página permite reativá-lo com resume() (fire-and-forget).
    void ctx.resume()
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    source.connect(analyser)

    const data = new Uint8Array(analyser.frequencyBinCount)
    silentSinceRef.current = null
    inSilenceRef.current = false

    const interval = setInterval(() => {
      analyser.getByteTimeDomainData(data)
      // RMS normalizado: 128 é o centro (silêncio).
      let sumSq = 0
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128
        sumSq += v * v
      }
      const rms = Math.sqrt(sumSq / data.length)

      const now = Date.now()
      if (rms < threshold) {
        if (silentSinceRef.current === null) silentSinceRef.current = now
        if (!inSilenceRef.current && now - silentSinceRef.current >= silenceMs) {
          inSilenceRef.current = true
          onSilenceRef.current()
        }
      } else {
        silentSinceRef.current = null
        if (inSilenceRef.current) {
          inSilenceRef.current = false
          onSpeechRef.current()
        }
      }
    }, POLL_INTERVAL_MS)

    return () => {
      clearInterval(interval)
      source.disconnect()
      analyser.disconnect()
      void ctx.close()
    }
  }, [stream, active, silenceMs, threshold])
}
