-- ─────────────────────────────────────────────────────────────────────────────
-- resolve_consultation: transição terminal atômica + idempotente
--
-- Resolve um atendimento in_progress para um estado terminal e devolve o
-- debit_source ANTIGO apenas para a chamada que efetivamente venceu a transição.
-- O SELECT ... FOR UPDATE trava a linha: chamadas concorrentes (dois gatilhos de
-- reconciliação, duplo clique de abandono, retry de Server Action) serializam —
-- a segunda enxerga status != 'in_progress' → NOT FOUND → retorna NULL → o
-- chamador não devolve crédito. Previne duplo refund.
--
-- debit_source é zerado na transição (reserva liquidada) como 2ª camada de
-- idempotência. raw_transcript é limpo (privacidade). created_at/updated_at NÃO
-- são tocados (preserva a data clínica real no caminho 'completed').
--
-- O chamador decide o p_new_status ('completed' se já havia anamnese, senão
-- 'abandoned') e só devolve crédito se houve retorno != null E nenhuma IA usada.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.resolve_consultation(
  p_user_id uuid,
  p_patient_id uuid,
  p_new_status text
)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_source text;
BEGIN
  -- Trava a linha somente se ainda estiver in_progress (mutex da transição).
  SELECT debit_source INTO v_source
  FROM consultations
  WHERE user_id = p_user_id
    AND patient_id = p_patient_id
    AND status = 'in_progress'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE consultations
  SET status = p_new_status,
      raw_transcript = NULL,
      debit_source = NULL
  WHERE user_id = p_user_id
    AND patient_id = p_patient_id;

  RETURN v_source;
END;
$function$;
