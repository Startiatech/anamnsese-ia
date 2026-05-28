-- RPC usada por saveTranscriptAndIncrementAttempts (POST /api/transcribe).
-- Estava ausente nos bancos (prod e teste), fazendo supabase.rpc(...) falhar em
-- silêncio: a transcrição não era salva e audio_attempts não incrementava (cota não
-- decrementava). NÃO toca em structured_anamnesis — preserva a anamnese existente.
CREATE OR REPLACE FUNCTION save_transcript_and_increment(
  p_user_id uuid,
  p_patient_id uuid,
  p_transcript text
)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE consultations
  SET
    raw_transcript = p_transcript,
    audio_attempts = audio_attempts + 1,
    updated_at = now()
  WHERE user_id = p_user_id AND patient_id = p_patient_id;
$$;
