import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { v4 as uuidv4 } from 'uuid'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 11) return value
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
  }
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
}

export function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export function formatCEP(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  return digits.replace(/^(\d{5})(\d)/, '$1-$2')
}

export function validateCPFFormat(value: string): boolean {
  return /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(value)
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString)
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const year = date.getUTCFullYear()
  return `${day}/${month}/${year}`
}

export function formatDateTime(isoString: string): string {
  const date = new Date(isoString)
  return `${formatDate(isoString)} às ${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`
}

export function generateId(): string {
  return uuidv4()
}

// Conectores que permanecem em minúsculo no meio do nome (não no início).
const NAME_CONNECTORS = new Set(['da', 'de', 'di', 'do', 'du', 'das', 'des', 'dos', 'e'])

/**
 * Capitaliza nomes em pt-br: primeira letra de cada palavra em maiúscula,
 * mantendo conectores ("da", "de", "do", "dos", "e"...) em minúsculo quando
 * não são a primeira palavra. Ex.: "joão da silva" → "João da Silva";
 * "MENTE LIVRE" → "Mente Livre". Espaços extras são normalizados.
 */
export function capitalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word, i) =>
      i > 0 && NAME_CONNECTORS.has(word)
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ')
}

/** "João da Silva Pereira" → "João Pereira" */
export function abbreviateName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length <= 2) return name
  return `${parts[0]} ${parts[parts.length - 1]}`
}

export function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?'
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase()
}
