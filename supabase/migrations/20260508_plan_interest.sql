create table if not exists plan_interest (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  plan       text not null check (plan in ('profissional', 'gestao-clinicas')),
  created_at timestamptz not null default now(),
  constraint plan_interest_email_plan_unique unique (email, plan)
);

alter table plan_interest enable row level security;

create policy "anon can insert plan_interest"
  on plan_interest for insert
  to anon
  with check (true);
