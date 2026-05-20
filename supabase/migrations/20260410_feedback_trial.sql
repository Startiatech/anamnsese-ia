-- supabase/migrations/20260410_feedback_trial.sql

-- ─── Tabela feedbacks ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedbacks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES users(id) ON DELETE CASCADE,
  rating          smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  message         text,
  plan_id         text NOT NULL DEFAULT 'experimental',
  action_taken    text NOT NULL DEFAULT 'pending',
  sentiment_score numeric,
  sentiment_label text,
  analyzed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedbacks_user_id_idx ON feedbacks(user_id);
CREATE INDEX IF NOT EXISTS feedbacks_action_taken_idx ON feedbacks(action_taken);
CREATE INDEX IF NOT EXISTS feedbacks_analyzed_at_idx ON feedbacks(analyzed_at) WHERE analyzed_at IS NULL;

-- ─── Colunas em users ────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deletion_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS bonus_credits smallint NOT NULL DEFAULT 0;

-- ─── RPC debit_user_credit (bonus primeiro) ──────────────────────────────────
CREATE OR REPLACE FUNCTION debit_user_credit(p_user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE users
  SET
    bonus_credits     = GREATEST(bonus_credits - 1, 0),
    credits_remaining = CASE
                          WHEN bonus_credits > 0 THEN credits_remaining
                          ELSE GREATEST(credits_remaining - 1, 0)
                        END
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── pg_cron: exclusão após grace period ─────────────────────────────────────
-- IMPORTANTE: Requer extensão pg_cron habilitada no Supabase (Dashboard → Extensions → pg_cron)
-- Executar manualmente APÓS habilitar a extensão:
--
-- SELECT cron.schedule(
--   'delete-expired-accounts',
--   '0 2 * * *',
--   $$DELETE FROM users WHERE deletion_scheduled_at IS NOT NULL AND deletion_scheduled_at <= now()$$
-- );
