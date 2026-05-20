export function formatBRL(usdValue: number, rate: number): string {
  return (usdValue * rate).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
}
