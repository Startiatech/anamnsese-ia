'use client'

import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { useApp } from '@/context/app-context'

const SEGMENT_LABELS: Record<string, string> = {
  requests:    'Solicitações',
  users:       'Usuários',
  plans:       'Planos',
  settings:    'Configurações',
  consultation:'Atendimento',
  history:     'Histórico',
  result:      'Resultado',
  onboarding:  'Onboarding',
  profile:     'Perfil',
}

const ROLE_LABEL: Record<string, string> = {
  master: 'master',
  admin:  'admin',
  user:   'user',
}

const ROOTS: { prefix: string; label: string; href: string }[] = [
  { prefix: '/console', label: 'Console',              href: '/console' },
  { prefix: '/app',     label: 'Área do Profissional', href: '/app/dashboard' },
]

export function ConsoleBreadcrumb() {
  const pathname = usePathname()
  const { user } = useApp()

  const role = user?.role ? ROLE_LABEL[user.role] : null
  const root = ROOTS.find((r) => pathname.startsWith(r.prefix)) ?? { prefix: '', label: 'Área do Profissional', href: '/app/dashboard' }

  const segments = [
    { label: root.label, href: root.href },
    ...pathname
      .replace(root.prefix, '')
      .split('/')
      .filter(Boolean)
      .map((seg) => ({
        label: SEGMENT_LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1),
        href: `${root.href}/${seg}`,
      })),
  ]

  return (
    <nav className="flex items-center gap-1.5 text-[11px] font-normal tracking-normal">
      {role && (
        <>
          <span className="font-mono text-highlight dark:text-highlight/70">{role}</span>
          <span className="text-muted-foreground/30 mx-0.5">|</span>
        </>
      )}
      {segments.map((seg, i) => (
        <span key={seg.href} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/30" />}
          <span className={i === segments.length - 1 ? 'text-primary' : 'text-foreground/40'}>
            {seg.label}
          </span>
        </span>
      ))}
    </nav>
  )
}
