export function LogoMark({ id = 'mark' }: { id?: string }) {
  const gradId = `logo-mark-grad-${id}`
  return (
    <svg width="24" height="24" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--logo-from-color)" />
          <stop offset="100%" stopColor="var(--logo-to-color)" />
        </linearGradient>
      </defs>
      <line x1="14" y1="2"    x2="14" y2="8"    stroke={`url(#${gradId})`} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="14" y1="20"   x2="14" y2="26"   stroke={`url(#${gradId})`} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2"  y1="14"   x2="8"  y2="14"   stroke={`url(#${gradId})`} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="20" y1="14"   x2="26" y2="14"   stroke={`url(#${gradId})`} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="5.5"  y1="5.5"  x2="9.5"  y2="9.5"  stroke={`url(#${gradId})`} strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.8" />
      <line x1="18.5" y1="18.5" x2="22.5" y2="22.5" stroke={`url(#${gradId})`} strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.8" />
      <line x1="22.5" y1="5.5"  x2="18.5" y2="9.5"  stroke={`url(#${gradId})`} strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.8" />
      <line x1="5.5"  y1="22.5" x2="9.5"  y2="18.5" stroke={`url(#${gradId})`} strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.8" />
      <line x1="14" y1="4"    x2="17.5" y2="6.5"  stroke={`url(#${gradId})`} strokeWidth="1"   strokeLinecap="round" strokeOpacity="0.4" />
      <line x1="14" y1="4"    x2="10.5" y2="6.5"  stroke={`url(#${gradId})`} strokeWidth="1"   strokeLinecap="round" strokeOpacity="0.4" />
      <line x1="14" y1="24"   x2="17.5" y2="21.5" stroke={`url(#${gradId})`} strokeWidth="1"   strokeLinecap="round" strokeOpacity="0.4" />
      <line x1="14" y1="24"   x2="10.5" y2="21.5" stroke={`url(#${gradId})`} strokeWidth="1"   strokeLinecap="round" strokeOpacity="0.4" />
      <circle cx="14" cy="14" r="1.8" fill={`url(#${gradId})`} />
    </svg>
  )
}

export function Logo({ size = 'md', id = 'default' }: { size?: 'sm' | 'md' | 'lg'; id?: string }) {
  const scales = { sm: 0.85, md: 1.15, lg: 1.6 }
  const s = scales[size]
  const w = Math.round(152 * s)
  const h = Math.round(28 * s)
  const sparkId = `spark-grad-${id}`
  const iaId = `ia-grad-${id}`

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
        <linearGradient id={sparkId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--logo-from-color)" />
          <stop offset="100%" stopColor="var(--logo-to-color)" />
        </linearGradient>
        <linearGradient id={iaId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--logo-from-color)" />
          <stop offset="100%" stopColor="var(--logo-to-color)" />
        </linearGradient>
      </defs>

      {/* Spark symbol */}
      <line x1="14" y1="2"    x2="14" y2="8"    stroke={`url(#${sparkId})`} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="14" y1="20"   x2="14" y2="26"   stroke={`url(#${sparkId})`} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2"  y1="14"   x2="8"  y2="14"   stroke={`url(#${sparkId})`} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="20" y1="14"   x2="26" y2="14"   stroke={`url(#${sparkId})`} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="5.5"  y1="5.5"  x2="9.5"  y2="9.5"  stroke={`url(#${sparkId})`} strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.8" />
      <line x1="18.5" y1="18.5" x2="22.5" y2="22.5" stroke={`url(#${sparkId})`} strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.8" />
      <line x1="22.5" y1="5.5"  x2="18.5" y2="9.5"  stroke={`url(#${sparkId})`} strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.8" />
      <line x1="5.5"  y1="22.5" x2="9.5"  y2="18.5" stroke={`url(#${sparkId})`} strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.8" />
      <line x1="14" y1="4"    x2="17.5" y2="6.5"  stroke={`url(#${sparkId})`} strokeWidth="1"   strokeLinecap="round" strokeOpacity="0.4" />
      <line x1="14" y1="4"    x2="10.5" y2="6.5"  stroke={`url(#${sparkId})`} strokeWidth="1"   strokeLinecap="round" strokeOpacity="0.4" />
      <line x1="14" y1="24"   x2="17.5" y2="21.5" stroke={`url(#${sparkId})`} strokeWidth="1"   strokeLinecap="round" strokeOpacity="0.4" />
      <line x1="14" y1="24"   x2="10.5" y2="21.5" stroke={`url(#${sparkId})`} strokeWidth="1"   strokeLinecap="round" strokeOpacity="0.4" />
      <circle cx="14" cy="14" r="1.8" fill={`url(#${sparkId})`} />

      {/* Wordmark */}
      <text
        x="34"
        y="19.5"
        fontFamily="'Inter', 'SF Pro Display', system-ui, sans-serif"
        fontSize="14"
        letterSpacing="-0.3"
        fill="var(--logo-text-color)"
      >
        <tspan fontWeight="400">anamnese </tspan>
        <tspan fontWeight="700" fill={`url(#${iaId})`} letterSpacing="0.5">IA</tspan>
      </text>
    </svg>
  )
}
