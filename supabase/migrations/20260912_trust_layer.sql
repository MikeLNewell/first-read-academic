-- First Read Trust Layer v1.0
-- Run once in Supabase SQL Editor before deploying the Trust Layer patch.

alter table public.assessment_profiles
  add column if not exists is_verified boolean not null default false;

alter table public.assessment_profiles
  add column if not exists verified_at timestamptz null;

create index if not exists assessment_profiles_verified_idx
  on public.assessment_profiles (is_verified, academic_year desc);

-- Existing profiles are intentionally left unverified.
-- Open each profile in First Read, confirm the brief/rubric/instructions, then click
-- "Verify assessment profile". Editing a verified profile automatically revokes
-- verification until it is checked again.
