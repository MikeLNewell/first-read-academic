-- First Read assessment library
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

create extension if not exists pgcrypto;

create table if not exists public.assessment_profiles (
  id uuid primary key default gen_random_uuid(),
  academic_year text not null check (academic_year ~ '^[0-9]{4}/[0-9]{2}$'),
  unit_code text not null,
  unit_name text not null,
  assessment_name text not null,
  academic_level text not null default '',
  word_count text not null default '',
  feedback_style text not null default '',
  assessment_brief text not null,
  learning_outcomes text not null default '',
  rubric text not null,
  additional_instructions text not null default '',
  version integer not null default 1 check (version between 1 and 99),
  is_archived boolean not null default false,
  source_profile_id uuid null references public.assessment_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assessment_profiles_year_idx
  on public.assessment_profiles (academic_year desc);

create index if not exists assessment_profiles_unit_idx
  on public.assessment_profiles (academic_year, unit_code);

alter table public.assessment_profiles enable row level security;

-- Deliberately create no anon/authenticated policies.
-- The browser cannot access this table directly. First Read's authenticated
-- Netlify Function uses the server-side service-role key instead.
