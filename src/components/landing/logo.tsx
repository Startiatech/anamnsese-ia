export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const scales = { sm: 0.85, md: 1.15, lg: 1.6 }
  const s = scales[size]
  const w = Math.round(132 * s)
  const h = Math.round(28 * s)

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 132 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="anamnese_IA_"
    >
      <defs>
        <linearGradient id="ia-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
      </defs>

      {/* Wordmark */}
      <text
        x="0"
        y="19.5"
        fontFamily="'Inter', 'SF Pro Display', system-ui, sans-serif"
        fontSize="14"
        letterSpacing="-0.3"
        fill="rgba(255,255,255,0.92)"
      >
        <tspan fontWeight="400">anamnese</tspan>
        <tspan fontWeight="700" fill="url(#ia-grad)" letterSpacing="0.5">_IA_</tspan>
      </text>
    </svg>
  )
}
