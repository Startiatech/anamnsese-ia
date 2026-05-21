// src/lib/schemas.ts
import { z } from 'zod'
import { isValidCnpj } from './clinic'

export const loginSchema = z.object({
  email: z.string().min(1, 'Email é obrigatório').email({ message: 'Email inválido' }),
  password: z.string().min(1, 'Senha é obrigatória').max(200),
})

export type LoginFormData = z.infer<typeof loginSchema>

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Email é obrigatório').email({ message: 'Email inválido' }),
  pin:   z.string().length(6, 'PIN deve ter 6 dígitos').regex(/^\d{6}$/, 'PIN deve conter apenas números'),
})

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>

export const setPinSchema = z.object({
  pin:        z.string().length(6, 'PIN deve ter 6 dígitos').regex(/^\d{6}$/, 'PIN deve conter apenas números'),
  confirmPin: z.string().length(6, 'Confirme o PIN'),
}).refine((d) => d.pin === d.confirmPin, { message: 'Os PINs não coincidem', path: ['confirmPin'] })

export type SetPinFormData = z.infer<typeof setPinSchema>

export const accessRequestSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100).trim(),
  email: z.string().min(1, 'Email é obrigatório').email({ message: 'Email inválido' }),
  specialty: z.string().min(2, 'Especialidade é obrigatória').max(100).trim(),
  message: z.string().max(1000).trim().optional(),
})

export type AccessRequestFormData = z.infer<typeof accessRequestSchema>

export const createUserSchema = z.object({
  name:      z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100).trim(),
  email:     z.string().min(1, 'Email é obrigatório').email({ message: 'Email inválido' }),
  specialty: z.string().min(2, 'Especialidade é obrigatória').max(100).trim(),
  phone:     z.string().min(8, 'Informe um telefone válido').max(20).trim(),
})

export type CreateUserFormData = z.infer<typeof createUserSchema>

function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false
  const calc = (limit: number) => {
    const sum = digits.slice(0, limit).split('').reduce((acc, d, i) => acc + Number(d) * (limit + 1 - i), 0)
    const rem = (sum * 10) % 11
    return rem === 10 || rem === 11 ? 0 : rem
  }
  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10])
}

export const patientSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100).trim(),
  cpf: z
    .string()
    .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF inválido — use o formato 000.000.000-00')
    .refine(isValidCpf, 'CPF inválido'),
  birthDate: z.string().min(1, 'Data de nascimento é obrigatória'),
  phone: z.string().max(20).trim().optional(),
  externalId: z.string().max(100).trim().optional(),
})

export type PatientFormData = z.infer<typeof patientSchema>

export const responsibilitySchema = z.object({
  confirmed: z.literal(true, {
    error: 'É necessário confirmar a autorização para continuar.',
  }),
})

export type ResponsibilityFormData = z.infer<typeof responsibilitySchema>

export const REGISTRY_TYPES = [
  'CRM',     // Medicina
  'CRP',     // Psicologia
  'CRO',     // Odontologia
  'CRN',     // Nutrição
  'CREFITO', // Fisioterapia
  'CRF',     // Farmácia
  'COREN',   // Enfermagem
  'CRBM',    // Biomedicina
  'CRFa',    // Fonoaudiologia
  'CRESS',   // Serviço Social
  'Outros',
] as const

export type RegistryType = typeof REGISTRY_TYPES[number]

export const profileSchema = z.object({
  name:                   z.string().min(3, 'Nome obrigatório').max(100).trim(),
  phone:                  z.string().max(20).trim().optional(),
  specialty:              z.string().min(2, 'Especialidade obrigatória').max(100).trim(),
  crmType:                z.enum(REGISTRY_TYPES),
  crmTypeCustom:          z.string().max(50).trim().optional(),
  crmNumber:              z.string().regex(/^\d{4,8}$/, 'Número inválido — somente dígitos (4 a 8)'),
  crmUf:                  z.string().length(2, 'UF obrigatória'),
  minutesPerConsultation: z.coerce.number().int().min(5, 'Mínimo 5 min').max(240, 'Máximo 240 min'),
}).superRefine((data, ctx) => {
  if (data.crmType === 'Outros' && (!data.crmTypeCustom || data.crmTypeCustom.trim().length < 2)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Informe o tipo de registro',
      path: ['crmTypeCustom'],
    })
  }
})

export type ProfileFormData = z.infer<typeof profileSchema>

export const PLAN_INTEREST_PLANS = ['profissional', 'gestao-clinicas'] as const
export type PlanInterestPlan = typeof PLAN_INTEREST_PLANS[number]

export const planInterestSchema = z.object({
  name:  z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100).trim(),
  email: z.string().min(1, 'Email é obrigatório').email({ message: 'Email inválido' }),
  plan:  z.enum(PLAN_INTEREST_PLANS),
})

export type PlanInterestFormData = z.infer<typeof planInterestSchema>

const PHONE_BR = /^(\(?\d{2}\)?[\s-]?)?\d{4,5}-?\d{4}$/

export const clinicSchema = z.object({
  clinicName: z.string().min(2, 'Nome da clínica obrigatório').max(120).trim(),
  clinicCnpj: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v.length === 14, 'CNPJ deve ter 14 dígitos')
    .refine(isValidCnpj, 'CNPJ inválido'),
  clinicAddress: z.string().min(5, 'Endereço obrigatório').max(200).trim(),
  clinicAddressNumber: z.string().trim().max(50).optional().default(''),
  clinicCep: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => /^\d{8}$/.test(v), 'CEP inválido'),
  clinicPhone: z
    .string()
    .trim()
    .max(20)
    .refine((v) => PHONE_BR.test(v), 'Telefone inválido'),
  clinicEmail: z.string().trim().max(120).email('Email inválido'),
  clinicWebsite: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => {
      if (!v) return ''
      return /^https?:\/\//i.test(v) ? v : `https://${v}`
    }),
  clinicRtIsSelf: z.boolean(),
  clinicRtName: z.string().trim().max(120).optional().default(''),
  clinicRtRegistry: z.string().trim().max(60).optional().default(''),
  clinicBusinessHours: z.string().trim().max(200).optional().default(''),
}).superRefine((data, ctx) => {
  if (data.clinicRtIsSelf === false) {
    if (!data.clinicRtName || data.clinicRtName.trim().length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['clinicRtName'], message: 'Nome do RT obrigatório' })
    }
    if (!data.clinicRtRegistry || data.clinicRtRegistry.trim().length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['clinicRtRegistry'], message: 'Registro do RT obrigatório' })
    }
  }
})

export type ClinicFormData = z.infer<typeof clinicSchema>
