import { unstable_cache } from 'next/cache'

const FALLBACK_RATE = 5.75

export const fetchUsdToBrl = unstable_cache(
  async (): Promise<number> => {
    try {
      const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL')
      if (!res.ok) return FALLBACK_RATE
      const data = await res.json() as { USDBRL: { bid: string } }
      const rate = parseFloat(data.USDBRL.bid)
      return Number.isFinite(rate) ? rate : FALLBACK_RATE
    } catch {
      return FALLBACK_RATE
    }
  },
  ['usd-to-brl-rate'],
  { revalidate: 3600 }
)
