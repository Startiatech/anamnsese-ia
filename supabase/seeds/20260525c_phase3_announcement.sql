-- 20260525c_phase3_announcement.sql
-- Seed manual: anuncia a Fase 3 da acessibilidade e ativa a feature flag.
--
-- USO:
--   1. Rodar APENAS APOS a migration 20260525b ja estar aplicada nos 2 bancos.
--   2. Trocar 'leojoosantss@gmail.com' pelo email do(s) usuario(s) que devem
--      receber o anuncio e ter o beta ativado.
--   3. Reaplicar ad-hoc quando incluir novos usuarios no beta.
--
-- Por que ad-hoc (e nao um INSERT global): no momento ha apenas usuarios de teste.
-- Quando a base crescer, podemos transformar em job programado que insere para todos.

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
  '/configuracoes',
  'Conhecer'
from target
where not exists (
  select 1 from public.notifications n
  where n.user_id = target.id
    and n.type = 'feature'
    and n.title = 'Acessibilidade ampliada'
);

-- Ativa a feature flag para o usuario alvo
update public.users
   set beta_a11y_v2 = true
 where email = 'leojoosantss@gmail.com';
