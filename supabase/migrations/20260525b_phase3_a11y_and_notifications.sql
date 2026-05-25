-- 20260525b_phase3_a11y_and_notifications.sql
-- Fase 3 da acessibilidade: 3 novos toggles, feature flag e sistema de notificacoes (sino).

-- ── 1. Novos toggles de acessibilidade (independentes, sem rotular condicao) ──
alter table public.users
  add column if not exists pref_spacing_increased boolean not null default false,
  add column if not exists pref_focus_highlight   boolean not null default false,
  add column if not exists pref_extra_reduced_motion boolean not null default false,
  add column if not exists beta_a11y_v2           boolean not null default false;

comment on column public.users.pref_spacing_increased is 'Aumenta line-height, letter-spacing e word-spacing para leitura';
comment on column public.users.pref_focus_highlight is 'Destaca visualmente o elemento atualmente focado';
comment on column public.users.pref_extra_reduced_motion is 'Desativa animacoes do app alem do prefers-reduced-motion do SO';
comment on column public.users.beta_a11y_v2 is 'Feature flag: libera UI da Fase 3 (3 toggles + presets) para o usuario';

-- ── 2. Sistema de notificacoes (sino na topbar) ──────────────────────────────
create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  type         text not null check (type in ('info', 'feature', 'warning')),
  title        text not null,
  body         text,
  action_url   text,
  action_label text,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, read_at)
  where read_at is null;

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

comment on table public.notifications is 'Feed de notificacoes do sino (topbar). Banners criticos (PIN, deletion) ficam fora.';
comment on column public.notifications.type is 'info | feature (novidade de release) | warning (atencao opcional, sem bloquear)';
