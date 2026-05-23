-- Adiciona campo phone (nullable) em plan_interest.
-- Novos cadastros via modal "Quero ser avisado" sao obrigados a informar
-- telefone (validacao Zod no client + server). Registros antigos ficam NULL.

ALTER TABLE public.plan_interest
ADD COLUMN IF NOT EXISTS phone text;
