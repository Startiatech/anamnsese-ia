'use client'
import { useEffect, useRef } from 'react'

export type WaveformVariant = 'recording' | 'silence' | 'paused'

interface AudioWaveformProps {
  /** Nível de volume atual, 0..1. */
  level: number
  variant: WaveformVariant
}

const BAR_COUNT = 48

// Exceção consciente à regra de UI (proibido cor hardcoded em componentes
// reutilizáveis): o Canvas 2D não consome CSS custom properties. Estes valores
// são aproximações visuais dos tokens da marca (--gradient-brand, em oklch) e do
// muted-foreground; manter sincronizados caso os tokens mudem.
const WAVEFORM_GRADIENT_FROM = '#8B5CF6' // ≈ início do --gradient-brand
const WAVEFORM_GRADIENT_TO = '#06B6D4'   // ≈ fim do --gradient-brand
const PAUSED_FILL = 'rgba(148,148,160,0.5)' // ≈ muted-foreground a ~50% de opacidade

const WAVEFORM_GAIN = 3 // amplifica o nível (0..1) para a onda preencher melhor a altura

const FALLBACK_WIDTH = 600
const FALLBACK_HEIGHT = 64

/**
 * Onda sonora ao vivo desenhada em canvas. Apenas apresentação: recebe o nível
 * e o estado, desenha. Não conhece gravação nem transcrição. Se o contexto 2d
 * não existir (jsdom/ambiente sem canvas), apenas não desenha — não quebra.
 */
export function AudioWaveform({ level, variant }: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const levelRef = useRef(level)
  levelRef.current = level
  const variantRef = useRef(variant)
  variantRef.current = variant
  const barsRef = useRef<number[]>(new Array(BAR_COUNT).fill(0))
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return // degradação graciosa (jsdom)

    // Reseta o histórico de barras ao trocar de variant
    barsRef.current.fill(0)

    // HiDPI: ajusta o buffer de rasterização ao tamanho físico da tela
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    const cssW = canvas.clientWidth || FALLBACK_WIDTH
    const cssH = canvas.clientHeight || FALLBACK_HEIGHT
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    ctx.scale(dpr, dpr)

    let running = true

    const draw = () => {
      if (!running) return
      const currentVariant = variantRef.current

      ctx.clearRect(0, 0, cssW, cssH)

      const bars = barsRef.current
      const sample = currentVariant === 'recording' ? Math.min(1, levelRef.current * WAVEFORM_GAIN) : 0
      bars.push(sample)
      bars.shift()

      const barWidth = cssW / BAR_COUNT
      const mid = cssH / 2

      if (currentVariant === 'paused') {
        ctx.fillStyle = PAUSED_FILL
      } else {
        const grad = ctx.createLinearGradient(0, 0, cssW, 0)
        grad.addColorStop(0, WAVEFORM_GRADIENT_FROM)
        grad.addColorStop(1, WAVEFORM_GRADIENT_TO)
        ctx.fillStyle = grad
      }

      for (let i = 0; i < bars.length; i++) {
        const amp = currentVariant === 'silence' || currentVariant === 'paused' ? 0.02 : bars[i]
        const barHeight = Math.max(2, amp * cssH)
        ctx.fillRect(i * barWidth, mid - barHeight / 2, barWidth * 0.6, barHeight)
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => {
      running = false
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [variant])

  return (
    <canvas
      ref={canvasRef}
      data-testid="audio-waveform"
      data-variant={variant}
      aria-label="Visualizador de áudio da gravação"
      role="img"
      width={FALLBACK_WIDTH}
      height={FALLBACK_HEIGHT}
      className="w-full h-16 rounded-lg bg-white/[0.03] border border-border"
    />
  )
}
