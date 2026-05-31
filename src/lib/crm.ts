/**
 * Formata o registro profissional no padrão "TIPO NÚMERO/UF" (ex.: "CRM 11111/AM").
 * Trata partes ausentes com elegância: sem UF vira "CRM 11111"; só o tipo vira "CRM".
 */
export function formatCrm(
  crmType?: string | null,
  crmNumber?: string | null,
  crmUf?: string | null,
): string {
  const type = (crmType ?? '').trim()
  const number = (crmNumber ?? '').trim()
  const uf = (crmUf ?? '').trim()

  if (!number && !uf) return type

  const numberUf = [number, uf].filter(Boolean).join('/')
  return [type, numberUf].filter(Boolean).join(' ')
}
