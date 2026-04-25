-- =============================================================================
-- One-time 100 free trial (lifetime) for NEW signups only
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run. Existing users get trial_lifetime_limit = 0 (no behaviour change).
-- =============================================================================

-- 1. Add the trial column. Default 0 so existing users get NO trial.
alter table public.profiles
  add column if not exists trial_lifetime_limit integer not null default 0;

comment on column public.profiles.trial_lifetime_limit is
  'One-time free leads pool (lifetime, not monthly). 0 = no trial. Used only when lead_generation_limit = 0.';

-- 2. Update the signup trigger so brand-new users get 100 trial leads
--    while keeping lead_generation_limit at 0 until you set a paid limit.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role, lead_generation_limit, trial_lifetime_limit)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'role', 'Manager'),
    0,
    100
  );
  return new;
end;
$$ language plpgsql security definer;

-- The existing trigger on auth.users (on_auth_user_created) already calls
-- public.handle_new_user(); no need to recreate it.

-- =============================================================================
-- Rollback (only if you need to undo):
--   create or replace function public.handle_new_user() ...  -- old version (without trial_lifetime_limit)
--   alter table public.profiles drop column if exists trial_lifetime_limit;
-- =============================================================================
