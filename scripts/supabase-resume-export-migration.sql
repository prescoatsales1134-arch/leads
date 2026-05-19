-- Resume PDF exports: monthly cap (UTC month) + one-time free trial + usage log
-- Run in Supabase → SQL Editor after competitor_analysis migration.
-- Trial: when resume_exports_per_month = 0 and resume_export_trial_used = false,
--        user may export one PDF; then trial flag is set server-side.
-- Plan defaults (set by admin): Basic 5, Standard 10, Premium 15 per UTC month.

alter table public.profiles
  add column if not exists resume_exports_per_month integer;

alter table public.profiles
  add column if not exists resume_export_trial_used boolean not null default false;

comment on column public.profiles.resume_exports_per_month is
  'Max resume PDF exports per UTC calendar month. NULL = unlimited. 0 = none until trial (once) or admin sets a plan.';

comment on column public.profiles.resume_export_trial_used is
  'After the one complimentary PDF export (while monthly limit is 0), set true server-side.';

update public.profiles
set resume_exports_per_month = 0
where resume_exports_per_month is null;

create table if not exists public.resume_export_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists resume_export_log_user_created
  on public.resume_export_log (user_id, created_at desc);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    lead_generation_limit,
    trial_lifetime_limit,
    content_posts_per_day,
    competitor_analysis_per_day,
    competitor_analysis_trial_used,
    resume_exports_per_month,
    resume_export_trial_used
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'role', 'Manager'),
    0,
    100,
    0,
    0,
    false,
    0,
    false
  );
  return new;
end;
$$ language plpgsql security definer;
