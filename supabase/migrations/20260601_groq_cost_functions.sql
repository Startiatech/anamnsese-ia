-- ─────────────────────────────────────────────────────────────────────────────
-- Funções de agregação de custo Groq (api_usage_log)
--
-- Estas funções já existiam em PRODUÇÃO criadas manualmente, mas nunca foram
-- versionadas no repo nem aplicadas no banco de dev — por isso a coluna
-- "Custo Groq" no console aparecia zerada no dev (a RPC não existia → erro →
-- getAllUsersCostSummary retornava {}).
--
-- Definições capturadas via pg_get_functiondef no banco --prod (fonte de verdade).
-- CREATE OR REPLACE → idempotente, seguro para rodar em prod e dev.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_total_groq_cost()
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select coalesce(sum(cost_usd), 0) from public.api_usage_log;
$function$;

CREATE OR REPLACE FUNCTION public.get_groq_cost_by_user(p_user_id uuid)
 RETURNS TABLE(endpoint text, total_cost numeric, call_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select
    endpoint,
    coalesce(sum(cost_usd), 0) as total_cost,
    count(*)                   as call_count
  from public.api_usage_log
  where user_id = p_user_id
  group by endpoint;
$function$;

CREATE OR REPLACE FUNCTION public.get_all_users_groq_cost()
 RETURNS TABLE(user_id uuid, total_cost numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select
    user_id,
    coalesce(sum(cost_usd), 0) as total_cost
  from public.api_usage_log
  group by user_id;
$function$;

CREATE OR REPLACE FUNCTION public.get_groq_cost_by_patient(p_user_id uuid, p_patient_id uuid)
 RETURNS TABLE(endpoint text, total_cost numeric, call_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select
    endpoint,
    coalesce(sum(cost_usd), 0) as total_cost,
    count(*)                   as call_count
  from public.api_usage_log
  where user_id = p_user_id
    and patient_id = p_patient_id
  group by endpoint;
$function$;

CREATE OR REPLACE FUNCTION public.get_groq_cost_summary()
 RETURNS TABLE(period text, cost numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT 'day'::text,   COALESCE(SUM(cost_usd), 0) FROM public.api_usage_log WHERE created_at >= now() - interval '1 day'
  UNION ALL
  SELECT 'week'::text,  COALESCE(SUM(cost_usd), 0) FROM public.api_usage_log WHERE created_at >= now() - interval '7 days'
  UNION ALL
  SELECT 'month'::text, COALESCE(SUM(cost_usd), 0) FROM public.api_usage_log WHERE created_at >= now() - interval '30 days'
  UNION ALL
  SELECT 'total'::text, COALESCE(SUM(cost_usd), 0) FROM public.api_usage_log;
$function$;
