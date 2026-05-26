'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight, Send, CheckCircle2, Pencil, Check, X } from 'lucide-react'
import { toast } from 'sonner'

// ─── Chat types & config ───────────────────────────────────────────────────

const STEPS = [
  { key: 'name',      question: 'Qual é o seu nome completo?',                                        placeholder: 'Dr. João Silva',               optional: false },
  { key: 'email',     question: (name: string) => `Prazer, ${name.split(' ')[0]}! Qual é o seu email?`, placeholder: 'seu@email.com',                optional: false },
  { key: 'specialty', question: 'Qual é a sua especialidade médica?',                                 placeholder: 'Clínica Geral, Cardiologia...', optional: false },
  { key: 'phone',     question: 'Qual é o seu WhatsApp?',                                             placeholder: '(11) 99999-9999',              optional: false },
  { key: 'message',   question: 'Quer deixar alguma mensagem? (opcional)',                             placeholder: 'Contexto de uso, dúvidas...',  optional: true  },
]

const validators: Record<string, (v: string) => string | null> = {
  name: (v) => {
    const t = v.trim()
    if (t.length < 2) return 'Digite pelo menos 2 caracteres.'
    if (!/^[A-Za-zÀ-ÖØ-öø-ÿ'\-\s]+$/.test(t)) return 'O nome deve conter apenas letras.'
    return null
  },
  email:     (v) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'Email inválido.' : null,
  specialty: (v) => {
    const t = v.trim()
    if (t.length < 2) return 'Informe sua especialidade.'
    if (!/^[A-Za-zÀ-ÖØ-öø-ÿ'\-\s]+$/.test(t)) return 'A especialidade deve conter apenas letras.'
    return null
  },
  phone:     (v) => !/^[\d\s\(\)\-\+]{8,}$/.test(v.trim()) ? 'Informe um telefone válido.' : null,
  message:   () => null,
}

type StepKey = 'name' | 'email' | 'specialty' | 'phone' | 'message'

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}
type FormData = Partial<Record<StepKey, string>>
interface Message { id?: string; from: 'bot' | 'user'; text: string; pending?: boolean }

// ─── Sub-components ────────────────────────────────────────────────────────

function SparkAvatar() {
  return (
    <div
      className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center bg-primary/10 border border-primary/20"
      aria-label="anamnese_IA_"
    >
      <span
        className="text-primary font-bold leading-none"
        style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: '11px', letterSpacing: '0.5px' }}
      >
        _IA_
      </span>
    </div>
  )
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-0.5">
      {[0,1,2].map((i) => (
        <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"
          style={{ animation: 'typingDot 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
      ))}
    </span>
  )
}

// ─── AccessRequestChat ─────────────────────────────────────────────────────

interface AccessRequestChatProps {
  onBack: () => void
}

export function AccessRequestChat({ onBack }: AccessRequestChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [chatInput, setChatInput] = useState('')
  const [inputError, setInputError] = useState('')
  const [formData, setFormData] = useState<FormData>({})
  const [showConfirm, setShowConfirm] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [editingField, setEditingField] = useState<StepKey | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editError, setEditError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [duplicateRequest, setDuplicateRequest] = useState<{ name: string; email: string; specialty: string; createdAt: string } | null>(null)
  const [showDuplicateAction, setShowDuplicateAction] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)
  const chatInitialized = useRef(false)

  const isTyping = messages.some((m) => m.pending)

  function botReply(text: string, delay = 800) {
    const id = crypto.randomUUID()
    setMessages((prev) => [...prev, { id, from: 'bot', text: '', pending: true }])
    setTimeout(() => {
      setMessages((prev) => prev.map((m) => m.id === id ? { id, from: 'bot', text } : m))
    }, delay)
  }

  function initChat() {
    if (chatInitialized.current) return
    chatInitialized.current = true
    setMessages([])
    setCurrentStep(0)
    setFormData({})
    setShowConfirm(false)
    setSubmitted(false)
    setDuplicateRequest(null)
    setShowDuplicateAction(false)

    const id1 = crypto.randomUUID()
    const id2 = crypto.randomUUID()
    setTimeout(() => {
      setMessages([{ id: id1, from: 'bot', text: '', pending: true }])
      setTimeout(() => {
        setMessages((prev) => prev.map((m) => m.id === id1
          ? { id: id1, from: 'bot', text: 'Olá! Vou te ajudar a solicitar acesso. São apenas algumas perguntas rápidas.' }
          : m
        ))
        setTimeout(() => {
          setMessages((prev) => [...prev, { id: id2, from: 'bot', text: '', pending: true }])
          setTimeout(() => {
            setMessages((prev) => prev.map((m) => m.id === id2
              ? { id: id2, from: 'bot', text: STEPS[0].question as string }
              : m
            ))
          }, 800)
        }, 400)
      }, 900)
    }, 300)
  }

  useEffect(() => {
    initChat()
  }, [])

  useEffect(() => {
    const t = setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    return () => clearTimeout(t)
  }, [messages])

  useEffect(() => {
    if (!isTyping) chatInputRef.current?.focus()
  }, [isTyping])

  async function handleChatSend() {
    const step = STEPS[currentStep]
    const value = chatInput.trim()
    if (!value && !step.optional) { setInputError('Este campo é obrigatório.'); return }
    const err = validators[step.key]?.(value)
    if (err) { setInputError(err); return }

    setInputError('')
    setMessages((prev) => [...prev, { from: 'user', text: value || '(sem mensagem)' }])
    const newData = { ...formData, [step.key]: value }
    setFormData(newData)
    setChatInput('')

    if (step.key === 'email') {
      const checkId = crypto.randomUUID()
      setMessages((prev) => [...prev, { id: checkId, from: 'bot', text: '', pending: true }])
      try {
        const res = await fetch(`/api/requests?email=${encodeURIComponent(value)}`)
        const { duplicate, request: existing } = await res.json()
        if (duplicate?.block) {
          const firstName = newData.name?.split(' ')[0]
          const msg = duplicate.status === 'approved'
            ? `Boa notícia, ${firstName}! Seu acesso já foi aprovado anteriormente. Verifique sua caixa de entrada ou entre em contato conosco pelo WhatsApp. 😊`
            : `${firstName}, já recebemos sua solicitação! Nossa equipe irá analisá-la em breve e você receberá um retorno pelo WhatsApp informado. Obrigado pela paciência! 🙏`
          if (existing) setDuplicateRequest(existing)
          setMessages((prev) => prev.map((m) => m.id === checkId ? { id: checkId, from: 'bot', text: msg } : m))
          setTimeout(() => setShowDuplicateAction(true), 800)
          return
        }
      } catch {
        // falha silenciosa — continua o fluxo normalmente
      }
      setMessages((prev) => prev.filter((m) => m.id !== checkId))
    }

    const nextStep = currentStep + 1
    if (nextStep < STEPS.length) {
      const nextQ = STEPS[nextStep].question
      const question = typeof nextQ === 'function' ? nextQ(newData.name ?? '') : nextQ
      botReply(question)
      setCurrentStep(nextStep)
    } else {
      botReply('Perfeito! Aqui está um resumo da sua solicitação:', 700)
      setTimeout(() => setShowConfirm(true), 1600)
    }
  }

  function startEdit(key: StepKey) {
    setEditingField(key)
    setEditValue(formData[key] ?? '')
    setEditError('')
  }

  function cancelEdit() {
    setEditingField(null)
    setEditValue('')
    setEditError('')
  }

  function saveEdit() {
    if (!editingField) return
    const value = editValue.trim()
    const step = STEPS.find((s) => s.key === editingField)
    if (!value && !step?.optional) { setEditError('Este campo é obrigatório.'); return }
    const err = value ? validators[editingField]?.(value) : null
    if (err) { setEditError(err); return }
    setFormData((prev) => ({ ...prev, [editingField]: value }))
    setEditingField(null)
    setEditValue('')
    setEditError('')
  }

  async function handleConfirm() {
    const createdAt = new Date().toISOString()
    setIsConfirming(true)

    const promise = fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formData }),
    }).then(async (res) => {
      if (res.status === 409) {
        const { status: prevStatus } = await res.json()
        const firstName = formData.name?.split(' ')[0]
        const msg = prevStatus === 'approved'
          ? `Boa notícia, ${firstName}! Identificamos que seu acesso já foi aprovado anteriormente. Verifique sua caixa de entrada ou entre em contato conosco pelo WhatsApp.`
          : `Já recebemos sua solicitação anteriormente, ${firstName}. Assim que for analisada, você receberá um retorno pelo WhatsApp informado. Obrigado pela paciência! 🙏`
        botReply(msg, 400)
        setTimeout(() => setSubmitted(true), 2200)
        return
      }
      if (!res.ok) throw new Error('Erro ao enviar solicitação')

      const lines = [
        '✅ *Anamnese IA — Nova solicitação de acesso*',
        '',
        'Um profissional de saúde solicitou acesso à plataforma. Seguem os dados para cadastro:',
        '',
        `*Nome:* ${formData.name}`,
        `*Email:* ${formData.email}`,
        `*Especialidade:* ${formData.specialty}`,
        `*WhatsApp:* ${formData.phone}`,
        formData.message ? `*Mensagem:* ${formData.message}` : null,
        '',
        `_Solicitado em ${new Date(createdAt).toLocaleString('pt-BR')}_`,
      ].filter(Boolean).join('\n')

      const adminPhone = process.env.NEXT_PUBLIC_ADMIN_WHATSAPP ?? ''
      if (adminPhone) window.open(`https://wa.me/${adminPhone}?text=${encodeURIComponent(lines)}`, '_blank')

      setShowConfirm(false)
      botReply('Solicitação enviada! Em breve entraremos em contato.', 400)
      setTimeout(() => setSubmitted(true), 1400)
    })

    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Solicitação enviada!',
      error: (e: Error) => e.message,
    })
    await promise.catch(() => {}).finally(() => setIsConfirming(false))
  }

  // ── Success state ──
  if (submitted) {
    const display = duplicateRequest ?? formData
    const createdAt = duplicateRequest?.createdAt
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/25">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 dark:text-emerald-400" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">Solicitação recebida!</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Nossa equipe irá analisar e você receberá uma resposta pelo WhatsApp ou e-mail informado em breve.
            </p>
          </div>
          <div className="p-4 rounded-xl text-left space-y-2 bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground/60 uppercase tracking-widest mb-3">Resumo</p>
            <p className="text-sm text-foreground"><span className="text-muted-foreground">Nome: </span>{display.name}</p>
            <p className="text-sm text-foreground"><span className="text-muted-foreground">Email: </span>{display.email}</p>
            <p className="text-sm text-foreground"><span className="text-muted-foreground">Especialidade: </span>{display.specialty}</p>
            {createdAt && (
              <p className="text-xs text-muted-foreground/50 pt-1 border-t border-border mt-2">
                Solicitado em {new Date(createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onBack} className="mx-auto gap-1.5">
            <ArrowLeft className="h-3 w-3" />
            Voltar ao login
          </Button>
        </div>
      </div>
    )
  }

  // ── Chat state ──
  return (
    <div className="flex-1 flex items-center justify-center px-6 py-4">
      <div className="w-full max-w-sm flex flex-col" style={{ height: 'min(500px, calc(100vh - 120px))' }}>

        {/* Chat header */}
        <div className="pb-4 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SparkAvatar />
              <div>
                <p className="text-sm font-semibold text-foreground">Assistente</p>
                <p className="text-xs text-muted-foreground/50">Solicitação de acesso</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5">
              <ArrowLeft className="h-3 w-3" />
              Já tenho acesso
            </Button>
          </div>
        </div>
        <div className="h-px bg-border shrink-0" />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={msg.id ?? i} className={`flex items-end gap-2 ${msg.from === 'user' ? 'justify-end' : ''}`} style={{ animation: 'msgIn 0.25s ease both' }}>
              {msg.from === 'bot' && <SparkAvatar />}
              <div className={`max-w-xs px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                msg.from === 'bot'
                  ? 'bg-muted border border-border text-foreground rounded-bl-[4px]'
                  : 'bg-violet-500/20 border border-violet-500/30 text-foreground rounded-br-[4px]'
              }`}>
                {msg.pending ? <TypingDots /> : msg.text}
              </div>
            </div>
          ))}

          {showDuplicateAction && (
            <div className="flex items-end gap-2">
              <SparkAvatar />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSubmitted(true)}
                className="gap-2 rounded-2xl rounded-bl-sm bg-violet-500/15 border border-violet-500/30 text-violet-700 dark:text-violet-400"
              >
                Ver minha solicitação
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {showConfirm && (
            <div className="flex items-end gap-2">
              <SparkAvatar />
              <div className="rounded-2xl rounded-bl-sm p-4 space-y-3 text-sm max-w-xs bg-muted border border-border">
                {(['name','email','specialty','phone','message'] as StepKey[])
                  .filter((k) => formData[k] || k === 'message')
                  .map((k) => ({ label: { name:'Nome', email:'Email', specialty:'Especialidade', phone:'WhatsApp', message:'Mensagem' }[k], key: k }))
                  .map(({ label, key }) => {
                    const step = STEPS.find((s) => s.key === key)
                    const isEditing = editingField === key
                    return (
                      <div key={key} className="group">
                        <span className="text-xs text-muted-foreground/60 uppercase tracking-wider">{label}</span>
                        {isEditing ? (
                          <div className="mt-1 space-y-1">
                            <div className="flex items-center gap-1.5">
                              <input
                                autoFocus
                                value={editValue}
                                inputMode={key === 'phone' ? 'tel' : undefined}
                                onChange={(e) => {
                                  const raw = e.target.value
                                  setEditValue(key === 'phone' ? maskPhone(raw) : raw)
                                  setEditError('')
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') { e.preventDefault(); saveEdit() }
                                  if (e.key === 'Escape') { e.preventDefault(); cancelEdit() }
                                }}
                                placeholder={step?.placeholder}
                                className="flex-1 min-w-0 bg-background border border-border rounded px-2 py-1 text-sm text-foreground outline-none focus:border-violet-500/60"
                              />
                              <Button variant="ghost" size="icon" onClick={saveEdit} disabled={isConfirming} className="h-7 w-7 shrink-0 text-emerald-600 hover:text-emerald-500">
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={cancelEdit} disabled={isConfirming} className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground">
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            {editError && <p className="text-xs text-destructive">{editError}</p>}
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-foreground/90 break-words flex-1 min-w-0">{formData[key] || <span className="italic text-muted-foreground/50">(sem mensagem)</span>}</p>
                            <button
                              type="button"
                              onClick={() => startEdit(key)}
                              disabled={isConfirming || editingField !== null}
                              className="opacity-60 hover:opacity-100 text-muted-foreground hover:text-violet-500 disabled:opacity-30 disabled:cursor-not-allowed shrink-0 mt-0.5"
                              aria-label={`Editar ${label}`}
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                <div className="mt-5 pt-4 border-t border-border">
                  <Button variant="outline" onClick={handleConfirm} disabled={isConfirming || editingField !== null} className="w-full border-violet-500/30 text-violet-700 dark:text-violet-300 hover:border-violet-500/60 hover:text-violet-800 dark:hover:text-violet-200">
                    {isConfirming ? 'Aguarde...' : 'Confirmar solicitação'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {!showConfirm && !showDuplicateAction && (
          <div className="pt-3 shrink-0">
            {inputError && <p className="text-xs text-destructive mb-2">{inputError}</p>}
            <div className="flex items-center gap-3 border-b border-border pb-3 focus-within:border-violet-500/60 transition-colors">
              <input ref={chatInputRef} value={chatInput}
                aria-label={STEPS[currentStep]?.placeholder || 'Campo de entrada'}
                inputMode={STEPS[currentStep]?.key === 'phone' ? 'tel' : undefined}
                onChange={(e) => {
                  const raw = e.target.value
                  const next = STEPS[currentStep]?.key === 'phone' ? maskPhone(raw) : raw
                  setChatInput(next); setInputError('')
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleChatSend() } }}
                placeholder={isTyping ? '...' : (STEPS[currentStep]?.optional ? `${STEPS[currentStep].placeholder} (opcional — Enter para pular)` : STEPS[currentStep]?.placeholder)}
                disabled={isTyping || messages.length === 0}
                className="flex-1 bg-transparent outline-none focus-visible:outline-none text-sm text-foreground placeholder:text-muted-foreground/60 disabled:opacity-40"
              />
              <Button variant="ghost" size="icon" onClick={handleChatSend} disabled={isTyping || messages.length === 0}
                className="h-6 w-6 text-violet-400 hover:text-violet-300">
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground/30 mt-2">Enter para enviar</p>
          </div>
        )}

      </div>
    </div>
  )
}
