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
      <circle cx="14" cy="14" r="1.8" fill={`url(#${gradId})`} />
    </svg>
  )
}

export function Logo({ size = 'md', id = 'default' }: { size?: 'sm' | 'md' | 'lg'; id?: string }) {
  const scales = { sm: 0.85, md: 1.15, lg: 1.6 }
  const s = scales[size]
  const w = Math.round(132 * s)
  const h = Math.round(28 * s)
  const iaId = `ia-grad-${id}`

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
        <linearGradient id={iaId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--logo-from-color)" />
          <stop offset="100%" stopColor="var(--logo-to-color)" />
        </linearGradient>
      </defs>

      {/* Wordmark */}
      <text
        x="0"
        y="19.5"
        fontFamily="'Inter', 'SF Pro Display', system-ui, sans-serif"
        fontSize="14"
        letterSpacing="-0.3"
        fill="var(--logo-text-color)"
      >
        <tspan fontWeight="400">anamnese</tspan>
        <tspan fontWeight="700" fill={`url(#${iaId})`} letterSpacing="0.5">_IA_</tspan>
      </text>
    </svg>
  )
}
