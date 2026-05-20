import { supabase } from '@/server/supabase'

export const CreditRepository = {
  async getCredits(userId: string): Promise<number> {
    const { data } = await supabase
      .from('users')
      .select('credits_remaining')
      .eq('id', userId)
      .single()
    return (data?.credits_remaining as number) ?? 0
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

  async addCredits(userId: string, amount: number): Promise<number> {
    const { data } = await supabase.rpc('add_user_credits', {
      p_user_id: userId,
      p_amount: amount,
    })
    return (data as number) ?? 0
  },
}
