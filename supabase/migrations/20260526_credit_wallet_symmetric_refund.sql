-- 1. Coluna para registrar de qual carteira saiu o débito de cada consulta
ALTER TABLE consultations
  ADD COLUMN debit_source text CHECK (debit_source IN ('bonus', 'paid'));

-- 2. Atualiza debit_user_credit para retornar a origem do débito
-- DROP necessario porque o tipo de retorno mudou (void -> text)
DROP FUNCTION IF EXISTS public.debit_user_credit(uuid);

CREATE OR REPLACE FUNCTION public.debit_user_credit(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bonus integer;
  v_source text;
BEGIN
  SELECT bonus_credits INTO v_bonus FROM users WHERE id = p_user_id;

  IF v_bonus IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_bonus > 0 THEN
    UPDATE users SET bonus_credits = bonus_credits - 1 WHERE id = p_user_id;
    v_source := 'bonus';
  ELSE
    UPDATE users
    SET credits_remaining = GREATEST(credits_remaining - 1, 0)
    WHERE id = p_user_id;
    v_source := 'paid';
  END IF;

  RETURN v_source;
END;
$function$;

-- 3. Estorno simétrico: aceita a carteira de destino
-- DROP necessario porque a assinatura mudou (adicionou p_source)
DROP FUNCTION IF EXISTS public.refund_user_credit(uuid);

CREATE OR REPLACE FUNCTION public.refund_user_credit(p_user_id uuid, p_source text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_source = 'bonus' THEN
    UPDATE users SET bonus_credits = bonus_credits + 1 WHERE id = p_user_id;
  ELSIF p_source = 'paid' THEN
    UPDATE users SET credits_remaining = credits_remaining + 1 WHERE id = p_user_id;
  ELSE
    RAISE EXCEPTION 'Invalid p_source: %', p_source;
  END IF;
END;
$function$;

-- 4. Nova RPC dedicada para injeção de bonus pelo master
CREATE OR REPLACE FUNCTION public.add_user_bonus_credits(p_user_id uuid, p_amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_new_total integer;
BEGIN
  IF p_amount < 1 THEN
    RAISE EXCEPTION 'amount must be >= 1';
  END IF;

  UPDATE users
  SET bonus_credits = bonus_credits + p_amount
  WHERE id = p_user_id
  RETURNING bonus_credits INTO v_new_total;

  RETURN COALESCE(v_new_total, 0);
END;
$function$;
