'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, KeyRound, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Topbar } from '@/components/layout/topbar'
import { loginSchema, LoginFormData, forgotPasswordSchema, ForgotPasswordFormData } from '@/lib/schemas'
import { ArrowLeft, Mic, FileText, Clock, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { AccessRequestChat } from './access-request-chat'
import { API, ROUTES } from '@/lib/routes'

export function LoginClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<'login' | 'request' | 'forgot'>(
    searchParams.get('mode') === 'solicitar' ? 'request' : 'login'
  )

  // Remove o param da URL imediatamente — F5 sempre volta para /login (modo entrar)
  useEffect(() => {
    if (searchParams.get('mode') === 'solicitar') {
      router.replace('/login')
    }
  }, [])

  // Login form
  const [showPassword, setShowPassword] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
  })

  async function onSubmit(data: LoginFormData) {
    const promise = fetch(API.login, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(async (res) => {
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Email ou senha incorretos')
      window.location.href = `${json.redirectTo}?login=1`
    })
    toast.promise(promise, { loading: 'Aguarde...', error: (err: Error) => err.message })
    await promise.catch(() => {})
  }

  // Forgot password form
  const {
    register: registerForgot,
    handleSubmit: handleForgotSubmit,
    watch: watchForgot,
    formState: { errors: forgotErrors, isSubmitting: forgotSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onTouched',
  })

  const forgotEmail = watchForgot('email') ?? ''

  async function onForgotSubmit(data: ForgotPasswordFormData) {
    const promise = fetch(API.forgotPassword, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(async (res) => {
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Email ou PIN incorretos')
      window.location.href = `${ROUTES.configuracoes}?reset=1`
    })
    toast.promise(promise, { loading: 'Aguarde...', error: (err: Error) => err.message })
    await promise.catch(() => {})
  }

  const FEATURES = [
    { icon: Mic,      text: 'Gravação direta na plataforma',        color: 'text-rose-600/80 dark:text-rose-400/80',     glow: 'rgba(244,63,94,0.10)',  border: 'rgba(244,63,94,0.25)' },
    { icon: FileText, text: 'Anamnese estruturada automaticamente', color: 'text-violet-600/80 dark:text-violet-400/80', glow: 'rgba(124,58,237,0.10)', border: 'rgba(124,58,237,0.25)' },
    { icon: Clock,    text: 'Economize até 70% do tempo',           color: 'text-cyan-700/80 dark:text-cyan-400/80',     glow: 'rgba(6,182,212,0.10)',  border: 'rgba(6,182,212,0.25)' },
    { icon: Shield,   text: 'Dados clínicos protegidos',            color: 'text-emerald-600/80 dark:text-emerald-400/80', glow: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.25)' },
  ]

  const backLink = (
    <Link href="/" className="flex h-8 items-center gap-1.5 px-3 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-lg bg-muted border border-transparent hover:border-border dark:hover:border-violet-500/40">
      <ArrowLeft className="h-3 w-3" />
      Voltar ao início
    </Link>
  )

  return (
    <div className="min-h-screen flex flex-col bg-background [background:var(--login-page-bg)]">
      <Topbar variant="public" right={backLink} />

      {/* Ambient glows */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-violet-600/6 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-cyan-500/4 rounded-full blur-[100px]" />
      </div>

      <div className="flex flex-1 pt-16">

      {/* LEFT — brand side (unified) */}
      <div className="hidden lg:flex flex-col justify-center w-1/2 px-12 xl:px-16 py-12 relative overflow-hidden">
        <div className="max-w-sm mx-auto w-full space-y-8">
          <div className="inline-flex items-center gap-3 text-xs text-muted-foreground/50 tracking-widest uppercase font-medium">
            <span className="w-6 h-px bg-violet-500/40" />
            voz · inteligência · documento
          </div>

          <h2 className="text-3xl xl:text-4xl font-black leading-tight tracking-tight">
            <span className="text-foreground">Sua consulta,</span><br />
            <span className="text-primary">
              documentada por IA.
            </span>
          </h2>

          <p className="text-sm text-muted-foreground leading-relaxed">
            Grave o atendimento. A IA transcreve, estrutura e gera a anamnese completa. Você foca no paciente.
          </p>

          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, text, color, glow, border }) => (
              <div key={text} className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: glow, border: `1px solid ${border}` }}
                >
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <span className="text-sm text-muted-foreground">{text}</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground/40 pt-2">Sem cartão de crédito · Aprovação em até 24h</p>
        </div>
      </div>

      {/* RIGHT — dynamic side */}
      <div className="flex-1 flex flex-col">

        {/* Mobile-only brand hero */}
        {mode === 'login' && (
          <div className="lg:hidden flex flex-col items-center justify-center px-8 py-12 text-center border-b border-black/5 dark:border-white/5">
            <p className="text-xs text-muted-foreground/40 tracking-widest uppercase mb-5">voz · inteligência · documento</p>
            <h2 className="text-3xl md:text-4xl font-black leading-tight tracking-tight mb-5">
              <span className="text-foreground">Sua consulta,</span><br />
              <span className="text-primary">
                documentada por IA.
              </span>
            </h2>
            <p className="text-base text-muted-foreground/70 leading-relaxed max-w-sm">
              Grave o atendimento. A IA transcreve, estrutura e gera a anamnese completa. Você foca no paciente.
            </p>
          </div>
        )}

        {/* LOGIN FORM */}
        {mode === 'login' && (
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="w-full max-w-sm">
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-foreground mb-1">Entrar</h1>
                <p className="text-sm text-muted-foreground">Entre com seu email e senha para acessar a plataforma</p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground/60 uppercase tracking-widest" htmlFor="email">Email</label>
                  <input id="email" type="email" placeholder="seu@email.com" {...register('email')}
                    className="w-full bg-transparent border-0 border-b border-black/10 dark:border-white/10 focus:border-violet-500/60 outline-none focus-visible:border-violet-500 focus-visible:ring-1 focus-visible:ring-violet-500/40 focus-visible:ring-offset-0 rounded-sm px-2 pb-2 text-foreground placeholder:text-muted-foreground/60 text-sm transition-colors" />
                  {errors.email && <p className="text-xs text-destructive pt-1">{errors.email.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground/60 uppercase tracking-widest" htmlFor="password">Senha</label>
                  <div className="relative">
                    <input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" {...register('password')}
                      className="w-full bg-transparent border-0 border-b border-black/10 dark:border-white/10 focus:border-violet-500/60 outline-none focus-visible:border-violet-500 focus-visible:ring-1 focus-visible:ring-violet-500/40 focus-visible:ring-offset-0 rounded-sm px-2 pb-2 text-foreground placeholder:text-muted-foreground/60 text-sm transition-colors pr-7" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => setShowPassword(p => !p)}
                      className="absolute right-0 bottom-2 z-10 h-6 w-6 text-muted-foreground/40 hover:text-muted-foreground">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {errors.password && <p className="text-xs text-destructive pt-1">{errors.password.message}</p>}
                </div>

                <div className="space-y-3 pt-2">
                  <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                    {isSubmitting ? 'Aguarde...' : 'Entrar'}
                  </Button>
                  <div className="flex justify-center">
                    <Button type="button" variant="link" onClick={() => setMode('forgot')}
                      disabled={isSubmitting}
                      className="p-0 h-auto text-xs text-muted-foreground/60 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed">
                      Esqueceu a senha?
                    </Button>
                  </div>
                  <div className="relative pt-1">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <span className="w-full h-px bg-border" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="px-2 bg-background text-xs text-muted-foreground/50">novo por aqui?</span>
                    </div>
                  </div>
                  <p className="text-center text-sm text-muted-foreground">
                    Não tem acesso?{' '}
                    <Button type="button" variant="link" onClick={() => setMode('request')}
                      disabled={isSubmitting}
                      className="p-0 h-auto text-primary hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed">
                      Solicitar
                    </Button>
                  </p>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* FORGOT PASSWORD */}
        {mode === 'forgot' && (
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="w-full max-w-sm">
              <button
                type="button"
                onClick={() => setMode('login')}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-8"
              >
                <ArrowLeft className="h-3 w-3" />
                Voltar ao login
              </button>

              <div className="mb-8">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)' }}>
                  <KeyRound className="h-5 w-5 text-violet-400" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-1">Esqueceu a senha?</h1>
                <p className="text-sm text-muted-foreground">
                  Informe seu email e o PIN de 6 dígitos cadastrado nas configurações para acessar sua conta.
                </p>
              </div>

              <form onSubmit={handleForgotSubmit(onForgotSubmit)} className="space-y-8">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground/60 uppercase tracking-widest" htmlFor="forgot-email">Email</label>
                  <input id="forgot-email" type="email" placeholder="seu@email.com" {...registerForgot('email')}
                    className="w-full bg-transparent border-0 border-b border-black/10 dark:border-white/10 focus:border-violet-500/60 outline-none focus-visible:border-violet-500 focus-visible:ring-1 focus-visible:ring-violet-500/40 focus-visible:ring-offset-0 rounded-sm px-2 pb-2 text-foreground placeholder:text-muted-foreground/60 text-sm transition-colors" />
                  {forgotErrors.email && <p className="text-xs text-destructive pt-1">{forgotErrors.email.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground/60 uppercase tracking-widest" htmlFor="forgot-pin">PIN (6 dígitos)</label>
                  <input id="forgot-pin" type="password" inputMode="numeric" maxLength={6} placeholder="••••••" {...registerForgot('pin')}
                    className="w-full bg-transparent border-0 border-b border-black/10 dark:border-white/10 focus:border-violet-500/60 outline-none focus-visible:border-violet-500 focus-visible:ring-1 focus-visible:ring-violet-500/40 focus-visible:ring-offset-0 rounded-sm px-2 pb-2 text-foreground placeholder:text-muted-foreground/60 text-sm transition-colors tracking-[0.5em]" />
                  {forgotErrors.pin && <p className="text-xs text-destructive pt-1">{forgotErrors.pin.message}</p>}
                </div>

                <div className="space-y-4 pt-2">
                  <Button type="submit" className="w-full" size="lg" disabled={forgotSubmitting}>
                    {forgotSubmitting ? 'Aguarde...' : 'Acessar conta'}
                  </Button>

                  {process.env.NEXT_PUBLIC_ADMIN_WHATSAPP && (
                    <a
                      href={(() => {
                        const num = process.env.NEXT_PUBLIC_ADMIN_WHATSAPP!.replace(/\D/g, '')
                        const now = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })
                        const msg = [
                          '🔐 Anamnese IA — Recuperação de acesso',
                          'Um usuário não consegue acessar a plataforma e não possui PIN cadastrado.',
                          '',
                          `Email: ${forgotEmail || '(não informado)'}`,
                          `Solicitado em ${now}`,
                        ].join('\n')
                        return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
                      })()}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-disabled={forgotSubmitting}
                      onClick={forgotSubmitting ? (e) => e.preventDefault() : undefined}
                      className={`flex items-center gap-3 rounded-xl p-4 w-full transition-colors bg-cyan-50 border border-cyan-200/70 dark:bg-cyan-500/[0.06] dark:border-cyan-500/15 ${forgotSubmitting ? 'opacity-30 cursor-not-allowed' : 'hover:opacity-90'}`}
                    >
                      <MessageCircle className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                      <div className="flex-1 text-left">
                        <p className="text-xs font-medium text-foreground">Não cadastrou um PIN?</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Falar com o suporte pelo WhatsApp</p>
                      </div>
                      <ArrowLeft className="h-3 w-3 text-cyan-600 dark:text-cyan-400 rotate-180 shrink-0" />
                    </a>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* CHAT / REQUEST */}
        {mode === 'request' && (
          <AccessRequestChat onBack={() => setMode('login')} />
        )}
      </div>

      </div>{/* end flex-1 pt-14 */}

      <style>{`
@keyframes typingDot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-3px); }
        }
        @keyframes msgIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
