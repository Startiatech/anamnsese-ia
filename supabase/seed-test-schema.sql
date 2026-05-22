-- Schema base do projeto Anamnese IA
-- Aplicar UMA VEZ no banco de teste (anamnese-ia-com-claude-code--teste)
-- Reordenado para respeitar dependencias de FK.
-- Apos rodar este arquivo, aplicar as migrations versionadas que ainda nao
-- estiverem refletidas (ver supabase/migrations/).

-- 1) plans (sem FK)
CREATE TABLE public.plans (
  id text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  price integer NOT NULL DEFAULT 0,
  quota integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT plans_pkey PRIMARY KEY (id)
);

-- 2) users (FK -> plans)
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'user'::text,
  specialty text,
  created_at timestamp with time zone DEFAULT now(),
  plan_id text DEFAULT 'experimental'::text,
  plan_selected boolean NOT NULL DEFAULT false,
  phone text,
  crm_type text DEFAULT 'CRM'::text,
  crm_number text,
  crm_uf text,
  onboarding_completed boolean NOT NULL DEFAULT false,
  password_is_temp boolean NOT NULL DEFAULT false,
  credits_remaining integer NOT NULL DEFAULT 5,
  blocked boolean NOT NULL DEFAULT false,
  deletion_scheduled_at timestamp with time zone,
  bonus_credits smallint NOT NULL DEFAULT 0,
  minutes_per_consultation integer NOT NULL DEFAULT 45,
  pin_hash text,
  pin_is_temp boolean NOT NULL DEFAULT false,
  clinic_name text,
  clinic_cnpj text,
  clinic_address text,
  clinic_cep text,
  clinic_phone text,
  clinic_email text,
  clinic_website text,
  clinic_logo_url text,
  clinic_logo_path text,
  clinic_rt_is_self boolean NOT NULL DEFAULT true,
  clinic_rt_name text,
  clinic_rt_registry text,
  clinic_business_hours text,
  clinic_address_number text,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id)
);

-- 3) patients (FK -> users)
CREATE TABLE public.patients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  cpf text NOT NULL,
  birth_date date,
  phone text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  external_id text,
  CONSTRAINT patients_pkey PRIMARY KEY (id),
  CONSTRAINT patients_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- 4) consultations (FK -> users, patients)
CREATE TABLE public.consultations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  raw_transcript text,
  structured_anamnesis jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'in_progress'::text CHECK (status = ANY (ARRAY['in_progress'::text, 'abandoned'::text, 'completed'::text])),
  current_step integer NOT NULL DEFAULT 1,
  audio_attempts integer NOT NULL DEFAULT 0,
  refinement_attempts integer NOT NULL DEFAULT 0,
  recording_consent_text text,
  CONSTRAINT consultations_pkey PRIMARY KEY (id),
  CONSTRAINT consultations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT consultations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id),
  -- Necessario para upsert com onConflict='user_id,patient_id' em
  -- src/server/repositories/db.ts (cada par medico+paciente armazena
  -- apenas a anamnese mais recente).
  CONSTRAINT consultations_user_id_patient_id_key UNIQUE (user_id, patient_id)
);

-- 5) api_usage_log (FK -> users, patients)
CREATE TABLE public.api_usage_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  patient_id uuid,
  endpoint text NOT NULL CHECK (endpoint = ANY (ARRAY['transcription'::text, 'anamnesis'::text, 'refine'::text])),
  model text NOT NULL,
  tokens_input integer,
  tokens_output integer,
  audio_seconds numeric,
  cost_usd numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT api_usage_log_pkey PRIMARY KEY (id),
  CONSTRAINT api_usage_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT api_usage_log_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id)
);

-- 6) feedbacks (FK -> users)
CREATE TABLE public.feedbacks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  message text,
  plan_id text NOT NULL DEFAULT 'experimental'::text,
  action_taken text NOT NULL DEFAULT 'pending'::text,
  sentiment_score numeric,
  sentiment_label text,
  analyzed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT feedbacks_pkey PRIMARY KEY (id),
  CONSTRAINT feedbacks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- 7) access_requests (sem FK)
CREATE TABLE public.access_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  specialty text NOT NULL,
  phone text NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT access_requests_pkey PRIMARY KEY (id)
);

-- 8) plan_interest (sem FK)
CREATE TABLE public.plan_interest (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  plan text NOT NULL CHECK (plan = ANY (ARRAY['profissional'::text, 'gestao-clinicas'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT plan_interest_pkey PRIMARY KEY (id)
);
