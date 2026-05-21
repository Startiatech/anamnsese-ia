/**
 * Rotas centralizadas da aplicação.
 * Nunca use strings de rota hardcoded — importe sempre daqui.
 */

// ─── Públicas ────────────────────────────────────────────────────────────────
export const ROUTES = {
  home:            '/',
  login:           '/login',
  loginRequest:    '/login?mode=solicitar',
  requestAccess:   '/request-access',

  // ─── Área do profissional (app) ──────────────────────────────────────────
  dashboard:       '/dashboard',
  atendimento:     '/consultation',
  atendimentoNovo: '/consultation/novo',
  atendimentoId:   (id: string) => `/consultation/${id}`,
  resultado:       (id: string) => `/result/${id}`,
  historico:       '/history',
  planos:          '/plans',
  configuracoes:   '/settings',
  onboarding:      '/onboarding',

  // ─── Console admin ───────────────────────────────────────────────────────
  console:              '/console',
  consoleSolicitacoes:  '/console/requests',
  consoleUsuarios:      '/console/users',
  consolePlanos:        '/console/plans',
  consoleFeedbacks:     '/console/feedbacks',
  consoleInteresses:    '/console/interesses',
  consoleSettings:      '/console/settings',
  consoleConfiguracoes: '/console/configuracoes',
} as const

// ─── API routes ──────────────────────────────────────────────────────────────
export const API = {
  // Auth
  login:          '/api/auth/login',
  forgotPassword: '/api/auth/forgot-password',
  logout:         '/api/auth/logout',
  me:             '/api/auth/me',
  meDebit:        '/api/auth/me/debit',
  meCredit:       '/api/auth/me/credit',
  mePin:          '/api/users/me/pin',
  clinicLogo:     '/api/users/me/clinic/logo',

  // Admin
  createUser:   '/api/admin/create-user',
  adminUsers:   '/api/admin/users',
  adminUserId:  (id: string) => `/api/admin/users/${id}`,
  adminPlanId:     (id: string) => `/api/admin/plans/${id}`,
  adminResetPin:   (id: string) => `/api/admin/users/${id}/reset-pin`,
  adminUserGroqCost: (id: string) => `/api/admin/users/${id}/groq-cost`,

  // Requests
  requests:    '/api/requests',
  requestId:   (id: string) => `/api/requests/${id}`,

  // App
  patients:       '/api/patients',
  patientsCheck:  '/api/patients/check',
  patientId:      (id: string) => `/api/patients/${id}`,
  patientLatestConsultation: (id: string) => `/api/patients/${id}/latest-consultation`,
  consultations:        '/api/consultations',
  consultationId:       (id: string) => `/api/consultations/${id}`,
  consultationsPage:    (offset: number, limit: number) => `/api/consultations?offset=${offset}&limit=${limit}`,
  transcribe:      '/api/transcribe',
  anamnesis:       '/api/anamnesis',
  anamnesisRefine: '/api/anamnesis/refine',
  stats:           '/api/stats',
  plans:           '/api/plans',

  // Cron
  cronPurgeAccounts: '/api/cron/purge-accounts',
} as const
