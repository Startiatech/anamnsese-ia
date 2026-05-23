import type { StoredUser } from '@/server/repositories/users'

export interface ClinicData {
  clinicName: string
  clinicCnpj: string
  clinicAddress: string
  clinicAddressNumber?: string
  clinicCep: string
  clinicPhone: string
  clinicEmail: string
  clinicLogoUrl?: string
  clinicLogoPath?: string
  clinicWebsite?: string
  clinicRtIsSelf: boolean
  clinicRtName?: string
  clinicRtRegistry?: string
  clinicBusinessHours?: string
}

export function isValidCnpj(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length !== 14) return false
  if (/^(\d)\1{13}$/.test(digits)) return false
  const calc = (slice: string, weights: number[]) => {
    const sum = slice.split('').reduce((acc, d, i) => acc + Number(d) * weights[i], 0)
    const rem = sum % 11
    return rem < 2 ? 0 : 11 - rem
  }
  const w1 = [5,4,3,2,9,8,7,6,5,4,3,2]
  const w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2]
  return calc(digits.slice(0,12), w1) === Number(digits[12])
      && calc(digits.slice(0,13), w2) === Number(digits[13])
}

/**
 * Considera o perfil completo quando os campos obrigatorios do
 * profileSchema (`src/lib/schemas.ts`) estao preenchidos. Usado para
 * decidir em qual tab do onboarding o usuario volta apos F5.
 */
export function isProfileComplete(user: StoredUser): boolean {
  const required = [user.name, user.specialty, user.crmNumber, user.crmUf]
  if (required.some((v) => !v || String(v).trim() === '')) return false
  // crmNumber deve ter 4 a 8 digitos
  if (!/^\d{4,8}$/.test(String(user.crmNumber))) return false
  // UF deve ter 2 chars
  if (String(user.crmUf).length !== 2) return false
  return true
}

export function isClinicComplete(user: StoredUser): boolean {
  const required = [
    user.clinicName, user.clinicCnpj, user.clinicAddress, user.clinicCep,
    user.clinicPhone, user.clinicEmail,
  ]
  if (required.some((v) => !v || String(v).trim() === '')) return false
  if (user.clinicRtIsSelf === false) {
    if (!user.clinicRtName?.trim() || !user.clinicRtRegistry?.trim()) return false
  }
  return true
}
