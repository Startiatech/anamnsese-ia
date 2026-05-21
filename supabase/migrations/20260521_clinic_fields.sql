-- 20260521_clinic_fields.sql
alter table public.users
  add column if not exists clinic_name text,
  add column if not exists clinic_cnpj text,
  add column if not exists clinic_address text,
  add column if not exists clinic_cep text,
  add column if not exists clinic_phone text,
  add column if not exists clinic_email text,
  add column if not exists clinic_website text,
  add column if not exists clinic_logo_url text,
  add column if not exists clinic_logo_path text,
  add column if not exists clinic_rt_is_self boolean not null default true,
  add column if not exists clinic_rt_name text,
  add column if not exists clinic_rt_registry text,
  add column if not exists clinic_business_hours text;
