// Senha provisória com CSPRNG (nunca Math.random): 16 hex chars (~64 bits de entropia).
// Gerada no client porque o fluxo precisa do texto plano para a mensagem de WhatsApp.
export function generateTempPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
