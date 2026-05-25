-- 20260525d_accessibility_requests.sql
-- Pedidos abertos de ajustes de acessibilidade enviados pelos usuarios.
-- Separado da tabela feedbacks (que e especifica de cancelamento de conta).

create table if not exists public.accessibility_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  message     text not null,
  status      text not null default 'pending'
    check (status in ('pending', 'read', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists accessibility_requests_pending_idx
  on public.accessibility_requests (created_at desc)
  where status = 'pending';

create index if not exists accessibility_requests_user_idx
  on public.accessibility_requests (user_id, created_at desc);

comment on table public.accessibility_requests is 'Pedidos abertos de novos ajustes de acessibilidade (alimenta roadmap).';
comment on column public.accessibility_requests.status is 'pending = nao lido | read = lido pelo admin | archived = ignorado/atendido';
