import Link from 'next/link'
import { Logo } from '@/components/ui/logo'
import { getServerUser } from '@/lib/auth-server'

export default async function NotFound() {
  const user = await getServerUser()
  const dashHref = user?.role === 'admin' || user?.role === 'master' ? '/console' : '/app/dashboard'
  const dashLabel = user?.role === 'admin' || user?.role === 'master' ? 'Ir para o console' : 'Ir para o dashboard'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      {/* Glow de fundo */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 40%, rgba(124,58,237,0.08) 0%, transparent 70%)',
        }}
      />

      <div className="relative flex flex-col items-center text-center max-w-md">
        {/* Logo */}
        <div className="mb-12">
          <Logo size="md" id="not-found" />
        </div>

        {/* 404 */}
        <div className="relative mb-6">
          <p
            className="text-[120px] font-black leading-none select-none"
            style={{
              background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(6,182,212,0.15))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 40px rgba(124,58,237,0.2))',
            }}
          >
            404
          </p>
          <div
            className="absolute inset-0 text-[120px] font-black leading-none select-none blur-2xl opacity-20"
            style={{
              background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
            aria-hidden
          >
            404
          </div>
        </div>

        <h1 className="text-xl font-semibold text-foreground mb-2">
          Página não encontrada
        </h1>
        <p className="text-sm text-muted-foreground mb-10 leading-relaxed">
          O endereço que você acessou não existe ou foi movido.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Link
            href="/"
            className="flex-1 py-2.5 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-center"
          >
            Página inicial
          </Link>
          <Link
            href={dashHref}
            className="flex-1 py-2.5 text-sm font-medium rounded-lg text-center transition-colors"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #0891B2)', color: '#fff' }}
          >
            {dashLabel}
          </Link>
        </div>
      </div>
    </div>
  )
}
