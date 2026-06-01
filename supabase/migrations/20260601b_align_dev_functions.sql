-- ─────────────────────────────────────────────────────────────────────────────
-- Alinhamento de funções prod → dev
--
-- Estas funções existiam em PRODUÇÃO (funcional) mas faltavam no banco de dev e
-- nunca foram versionadas no repo. No dev isso quebrava:
--   - increment_refinement_attempt → refinamento de anamnese (refine/route.ts)
--   - get_professionals_count       → contagem no dashboard do console
--   - add_user_credits              → injeção de créditos pelo master
--
-- Definições capturadas via pg_get_functiondef no banco --prod (fonte de verdade).
-- CREATE OR REPLACE → idempotente.
--
-- Nota: debit_credit(p_user_id) existe no prod mas é órfã (o código usa
-- debit_user_credit). Deliberadamente NÃO versionada aqui.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.add_user_credits(p_user_id uuid, p_amount integer)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_new_total INTEGER;
BEGIN
  UPDATE users
  SET credits_remaining = GREATEST(0, credits_remaining + p_amount)
  WHERE id = p_user_id
  RETURNING credits_remaining INTO v_new_total;

  RETURN COALESCE(v_new_total, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_professionals_count()
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT COUNT(*)
  FROM public.users
  WHERE role = 'user'
    AND blocked = false
    AND deletion_scheduled_at IS NULL;
$function$;

CREATE OR REPLACE FUNCTION public.increment_refinement_attempt(p_user_id uuid, p_patient_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current   integer;
  v_plan_id   text;
  v_limit     integer;
  v_features  jsonb;
  v_f6        jsonb;
BEGIN
  -- Get plan limit for f6
  SELECT u.plan_id INTO v_plan_id FROM users u WHERE u.id = p_user_id;
  SELECT p.features INTO v_features FROM plans p WHERE p.id = v_plan_id;

  SELECT elem INTO v_f6
  FROM jsonb_array_elements(v_features) AS elem
  WHERE elem->>'id' = 'f6'
  LIMIT 1;

  -- Upsert: create row if absent (with safe defaults), ignore if exists
  INSERT INTO consultations (
    user_id, patient_id,
    raw_transcript, structured_anamnesis,
    status, current_step,
    audio_attempts, refinement_attempts
  )
  VALUES (
    p_user_id, p_patient_id,
    '', '{"sections":[]}'::jsonb,
    'in_progress', 5,
    0, 0
  )
  ON CONFLICT (user_id, patient_id) DO NOTHING;

  -- Read current attempts
  SELECT refinement_attempts INTO v_current
  FROM consultations
  WHERE user_id = p_user_id AND patient_id = p_patient_id;

  -- Check quota (null = unlimited)
  IF v_f6 IS NOT NULL AND (v_f6->'limit') IS NOT NULL AND (v_f6->>'limit') IS NOT NULL THEN
    v_limit := (v_f6->>'limit')::integer;
    IF v_current >= v_limit THEN
      RAISE EXCEPTION 'refinement_quota_exceeded';
    END IF;
  END IF;

  -- Increment
  UPDATE consultations
  SET refinement_attempts = refinement_attempts + 1
  WHERE user_id = p_user_id AND patient_id = p_patient_id;

  RETURN v_current + 1;
END;
$function$;
