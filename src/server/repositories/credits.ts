import { supabase } from '@/server/supabase'

export const CreditRepository = {
  async getCredits(userId: string): Promise<number> {
    const { data } = await supabase
      .from('users')
      .select('credits_remaining, bonus_credits')
      .eq('id', userId)
      .single()
    const paid = (data?.credits_remaining as number) ?? 0
    const bonus = (data?.bonus_credits as number) ?? 0
    return paid + bonus
  },

  async setCredits(userId: string, value: number): Promise<void> {
    await supabase
      .from('users')
      .update({ credits_remaining: Math.max(0, value) })
      .eq('id', userId)
  },

  async debitCredit(userId: string): Promise<void> {
    await supabase.rpc('debit_user_credit', { p_user_id: userId })
  },

  async debitCreditReturningSource(userId: string): Promise<'bonus' | 'paid' | null> {
    const { data } = await supabase.rpc('debit_user_credit', { p_user_id: userId })
    return (data as 'bonus' | 'paid' | null) ?? null
  },

  async refundCredit(userId: string, source: 'bonus' | 'paid'): Promise<void> {
    await supabase.rpc('refund_user_credit', { p_user_id: userId, p_source: source })
  },

  async addBonusCredits(userId: string, amount: number): Promise<number> {
    const { data } = await supabase.rpc('add_user_bonus_credits', {
      p_user_id: userId,
      p_amount: amount,
    })
    return (data as number) ?? 0
  },

  async getCreditsBreakdown(userId: string): Promise<{ bonus: number; paid: number; total: number }> {
    const { data } = await supabase
      .from('users')
      .select('credits_remaining, bonus_credits')
      .eq('id', userId)
      .single()
    const paid = (data?.credits_remaining as number) ?? 0
    const bonus = (data?.bonus_credits as number) ?? 0
    return { bonus, paid, total: paid + bonus }
  },
}
