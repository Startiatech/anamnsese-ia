'use client'

interface SkipLinkProps {
  /** id do <main> ou container a focar quando o usuario ativar o link */
  targetId?: string
  /** texto exibido — pt-br por padrao */
  label?: string
}

export function SkipLink({ targetId = 'main-content', label = 'Pular para o conteúdo principal' }: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[300] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {label}
    </a>
  )
}
