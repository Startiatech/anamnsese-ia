'use client'

import { ShieldAlert } from 'lucide-react'
import { ROUTES } from '@/lib/routes'

interface PinTempBannerProps {
  pinIsTemp: boolean
}

export function PinTempBanner({ pinIsTemp }: PinTempBannerProps) {
  if (!pinIsTemp) return null

  return (
    <div className="w-full border-b border-amber-300/40 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/[0.08] px-4 py-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
      <div className="flex items-center gap-2 text-sm">
        <ShieldAlert className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
        <span className="text-amber-900/80 dark:text-amber-200/80">
          Seu <strong className="text-amber-600 dark:text-amber-400">PIN de recuperação</strong> foi redefinido pelo suporte. Cadastre um novo PIN para garantir o acesso à sua conta.
        </span>
      </div>
      <a
        href={`${ROUTES.configuracoes}?pin=1`}
        className="self-end sm:self-auto shrink-0 text-xs font-medium text-amber-600 dark:text-amber-400 border border-amber-400/40 dark:border-amber-500/40 rounded-lg px-3 py-1.5 hover:bg-amber-100 dark:hover:bg-amber-500/10 transition-colors"
      >
        Atualizar PIN
      </a>
    </div>
  )
}
