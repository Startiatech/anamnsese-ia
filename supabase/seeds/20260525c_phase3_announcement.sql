-- 20260525c_phase3_announcement.sql
-- Seed manual: anuncia a Fase 3 da acessibilidade via notificacao do sino.
--
-- USO:
--   1. Trocar 'leojoosantss@gmail.com' pelo email do(s) usuario(s) que devem
--      receber o anuncio.
--   2. Reaplicar ad-hoc quando quiser anunciar para novos usuarios.
--
-- Por que ad-hoc (e nao um INSERT global): no momento ha apenas usuarios de teste.
-- Quando a base crescer, podemos transformar em job programado que insere para todos.
--
-- Nota: os 3 toggles da Fase 3 sao GA (visiveis para todos). O feature flag
-- beta_a11y_v2 foi removido na migration 20260528b.

with target as (
  select id from public.users where email = 'leojoosantss@gmail.com'
)
-- Insere a notificacao do sino apenas se ainda nao existir para o usuario
insert into public.notifications (user_id, type, title, body, action_url, action_label)
select
  target.id,
  'feature',
  'Acessibilidade ampliada',
  'Agora voce pode ajustar espacamento de leitura, destacar o elemento em foco e reduzir animacoes. Disponivel em Configuracoes > Acessibilidade.',
  '/app/settings?tab=acessibilidade',
  'Conhecer'
from target
where not exists (
  select 1 from public.notifications n
  where n.user_id = target.id
    and n.type = 'feature'
    and n.title = 'Acessibilidade ampliada'
);
