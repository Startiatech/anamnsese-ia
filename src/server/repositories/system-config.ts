import { supabase } from '@/server/supabase'

export const SystemConfigRepository = {
  async get(key: string): Promise<string | null> {
    const { data } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', key)
      .maybeSingle()
    return data ? (data as { value: string }).value : null
  },

  async set(key: string, value: string): Promise<void> {
    await supabase
      .from('system_config')
      .upsert({ key, value }, { onConflict: 'key' })
  },
}
