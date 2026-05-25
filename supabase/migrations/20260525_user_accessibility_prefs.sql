-- 20260525_user_accessibility_prefs.sql
-- Preferencias de acessibilidade do usuario (Fase 2 - WCAG AA boas praticas)
alter table public.users
  add column if not exists pref_font_size text not null default 'normal'
    check (pref_font_size in ('normal', 'large', 'xlarge')),
  add column if not exists pref_high_contrast boolean not null default false;

comment on column public.users.pref_font_size is 'Tamanho de fonte preferido: normal | large | xlarge';
comment on column public.users.pref_high_contrast is 'Tema de alto contraste habilitado';
