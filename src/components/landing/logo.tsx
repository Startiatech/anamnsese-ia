export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const scales = { sm: 0.85, md: 1.15, lg: 1.6 }
  const s = scales[size]
  const w = Math.round(152 * s)
  const h = Math.round(28 * s)

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 152 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Anamnese IA"
    >
      <defs>
        <linearGradient id="spark-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
        <linearGradient id="ia-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
      </defs>

      {/* Spark symbol — radial lines from center, mimicking the image */}
      {/* Cardinal lines — longer */}
      <line x1="14" y1="2"    x2="14" y2="8"    stroke="url(#spark-grad)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="14" y1="20"   x2="14" y2="26"   stroke="url(#spark-grad)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2"  y1="14"   x2="8"  y2="14"   stroke="url(#spark-grad)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="20" y1="14"   x2="26" y2="14"   stroke="url(#spark-grad)" strokeWidth="1.5" strokeLinecap="round" />
      {/* Diagonal lines — medium */}
      <line x1="5.5"  y1="5.5"  x2="9.5"  y2="9.5"  stroke="url(#spark-grad)" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.8" />
      <line x1="18.5" y1="18.5" x2="22.5" y2="22.5" stroke="url(#spark-grad)" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.8" />
      <line x1="22.5" y1="5.5"  x2="18.5" y2="9.5"  stroke="url(#spark-grad)" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.8" />
      <line x1="5.5"  y1="22.5" x2="9.5"  y2="18.5" stroke="url(#spark-grad)" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.8" />
      {/* In-between lines — shorter, subtle */}
      <line x1="14" y1="4"    x2="17.5" y2="6.5"  stroke="url(#spark-grad)" strokeWidth="1"   strokeLinecap="round" strokeOpacity="0.4" />
      <line x1="14" y1="4"    x2="10.5" y2="6.5"  stroke="url(#spark-grad)" strokeWidth="1"   strokeLinecap="round" strokeOpacity="0.4" />
      <line x1="14" y1="24"   x2="17.5" y2="21.5" stroke="url(#spark-grad)" strokeWidth="1"   strokeLinecap="round" strokeOpacity="0.4" />
      <line x1="14" y1="24"   x2="10.5" y2="21.5" stroke="url(#spark-grad)" strokeWidth="1"   strokeLinecap="round" strokeOpacity="0.4" />
      {/* Center dot */}
      <circle cx="14" cy="14" r="1.8" fill="url(#spark-grad)" />

      {/* Wordmark */}
      <text
        x="34"
        y="19.5"
        fontFamily="'Inter', 'SF Pro Display', system-ui, sans-serif"
        fontSize="14"
        letterSpacing="-0.3"
        fill="rgba(255,255,255,0.92)"
      >
        <tspan fontWeight="400">anamnese </tspan>
        <tspan fontWeight="700" fill="url(#ia-grad)" letterSpacing="0.5">IA</tspan>
      </text>
    </svg>
  )
}
