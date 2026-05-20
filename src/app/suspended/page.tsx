import Link from 'next/link'
import { ROUTES, API } from '@/lib/routes'
import { Topbar } from '@/components/layout/topbar'
import { ShieldOff, MessageCircle, RefreshCw, Clock, CreditCard, HeadphonesIcon, AlertCircle } from 'lucide-react'

const SUPPORT_WHATSAPP = '5532999447711'

const TIPS = [
  {
    icon: Clock,
    title: 'Suspensão temporária',
    text: 'Contas inativas são suspensas automaticamente. Normalmente basta regularizar para reativar.',
    color: 'text-amber-400',
    glow: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.2)',
  },
  {
    icon: CreditCard,
    title: 'Plano e assinatura',
    text: 'Verifique se há alguma pendência no seu plano. O suporte pode esclarecer a situação.',
    color: 'text-violet-400',
    glow: 'rgba(139,92,246,0.1)',
    border: 'rgba(139,92,246,0.2)',
  },
  {
    icon: HeadphonesIcon,
    title: 'Suporte rápido',
    text: 'Nossa equipe responde em minutos pelo WhatsApp durante o horário comercial.',
    color: 'text-cyan-400',
    glow: 'rgba(6,182,212,0.1)',
    border: 'rgba(6,182,212,0.2)',
  },
]

export default function SuspendedPage() {
  const whatsappUrl = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent('Olá! Minha conta no Anamnese IA está suspensa. Pode me ajudar?')}`

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Topbar variant="public" />

      {/* Ambient glows */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-violet-600/6 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-cyan-500/4 rounded-full blur-[100px]" />
      </div>

      <div className="flex flex-1 pt-16">

        {/* LEFT — info side */}
        <div
          className="hidden md:flex flex-col w-1/2 px-8 lg:px-16 py-10 relative overflow-hidden"
          style={{ borderRight: '1px solid rgba(255,255,255,0.03)' }}
        >
          <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
            <div className="inline-flex items-center gap-3 text-xs text-muted-foreground/50 tracking-widest uppercase font-medium mb-8">
              <span className="w-6 h-px bg-violet-500/40" />
              conta suspensa
            </div>

            <h2 className="text-3xl font-black leading-tight tracking-tight mb-4">
              <span className="text-foreground">Sua conta está</span><br />
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(110deg, #A78BFA 0%, #38BDF8 60%, #34D399 100%)', WebkitBackgroundClip: 'text' }}
              >
                temporariamente inativa.
              </span>
            </h2>

            <p className="text-sm text-muted-foreground leading-relaxed mb-10">
              Não se preocupe — a situação pode ser resolvida rapidamente. Veja abaixo o que pode ter acontecido e como resolver.
            </p>

            <div className="space-y-3">
              {TIPS.map(({ icon: Icon, title, text, color, glow, border }) => (
                <div
                  key={title}
                  className="flex items-start gap-3 p-3 rounded-xl"
                  style={{ background: glow, border: `1px solid ${border}` }}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: glow, border: `1px solid ${border}` }}>
                    <Icon className={`h-3.5 w-3.5 ${color}`} />
                  </div>
                  <div>
                    <p className={`text-xs font-semibold mb-0.5 ${color}`}>{title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground/40">Suporte disponível em horário comercial via WhatsApp</p>
        </div>

        {/* RIGHT — action side */}
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="w-full max-w-sm space-y-8">

            {/* Icon + heading */}
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div
                  className="h-16 w-16 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)' }}
                >
                  <ShieldOff className="h-8 w-8 text-violet-400" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-1">Acesso suspenso</h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Sua conta está temporariamente inativa.<br />Entre em contato com o suporte para resolver.
                </p>
              </div>
            </div>

            {/* Alert box */}
            <div
              className="flex items-start gap-3 p-4 rounded-xl"
              style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}
            >
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Após regularizar sua situação com o suporte, atualize esta página para voltar ao sistema.
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #A78BFA, #22D3EE)', color: '#0d0a1a' }}
              >
                <MessageCircle className="h-4 w-4" />
                Falar com suporte
              </a>

              <a
                href={ROUTES.dashboard}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium transition-colors"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar página
              </a>

              <div className="pt-1 text-center">
                <Link
                  href={API.logout}
                  className="text-xs text-muted-foreground/50 hover:text-muted-foreground underline underline-offset-4 transition-colors"
                >
                  Sair da conta
                </Link>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}
