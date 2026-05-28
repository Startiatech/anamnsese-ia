-- 20260528b_drop_beta_a11y_v2.sql
-- Remove a feature flag beta_a11y_v2: os 3 toggles da Fase 3 (espacamento,
-- destaque de foco, reduzir movimento) agora sao GA e visiveis para todos os
-- usuarios. A coluna nao e mais lida pelo codigo.
--
-- USO: aplicar nos 2 bancos (prod e teste).

alter table public.users
  drop column if exists beta_a11y_v2;
