'use client'
import { useEffect, useRef } from 'react'

export type WaveformVariant = 'recording' | 'silence' | 'paused'

interface AudioWaveformProps {
  /** Nível de volume atual, 0..1. */
  level: number
  variant: WaveformVariant
}

const BAR_COUNT = 48

// Exceção consciente à regra de UI (proibido rgba hardcoded em componentes
// reutilizáveis): o Canvas 2D não consome CSS vars. Manter sincronizado com o
// token shadcn muted-foreground (~50% de opacidade) caso ele mude.
const PAUSED_FILL = 'rgba(148,148,160,0.5)'

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
    const cssW = canvas.clientWidth || 600
    const cssH = canvas.clientHeight || 64
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    ctx.scale(dpr, dpr)

    let running = true

    const draw = () => {
      if (!running) return
      const currentVariant = variantRef.current

      ctx.clearRect(0, 0, cssW, cssH)

      const bars = barsRef.current
      const sample = currentVariant === 'recording' ? Math.min(1, levelRef.current * 3) : 0
      bars.push(sample)
      bars.shift()

      const barWidth = cssW / BAR_COUNT
      const mid = cssH / 2

      if (currentVariant === 'paused') {
        ctx.fillStyle = PAUSED_FILL
      } else {
        const grad = ctx.createLinearGradient(0, 0, cssW, 0)
        grad.addColorStop(0, '#8B5CF6')
        grad.addColorStop(1, '#06B6D4')
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
      width={600}
      height={64}
      className="w-full h-16 rounded-lg bg-white/[0.03] border border-border"
    />
  )
}
