-- =============================================================================
-- One-time 100 free trial (lifetime, not per month) — run in Supabase SQL Editor
-- =============================================================================
-- What this does (plain English):
-- 1) Adds a column: how many leads someone may ever get on a free account (0 or 100).
-- 2) Fills 0 for everyone who already has an account (so they are NOT on trial).
-- 3) Updates the sign-up rule: brand-new users get 100 in that column, 0 paid cap.
--
-- Run the whole file once. Safe to re-run only the ADD/MIGRATE parts; if the
-- column already exists, skip step 1 or use IF NOT EXISTS pattern below.
-- =============================================================================

-- Step 1: add the column (skip if you already added it and get an error)
alter table public.profiles
  add column if not exists trial_lifetime_limit integer not null default 0;

comment on column public.profiles.trial_lifetime_limit is
  'Max leads allowed all-time on free (trial) before payment. 100 for new signups, 0 for no trial. Ignored when lead_generation_limit is positive (paid) or null (unlimited).';

-- (Existing profile rows get default 0 for the new column — so old users do not receive a new trial.)

-- Step 2: new signups get 100 one-time free leads, paid cap stays 0 until you set it
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

-- Note: trigger "on_auth_user_created" should already point at this function; no need to recreate it.
