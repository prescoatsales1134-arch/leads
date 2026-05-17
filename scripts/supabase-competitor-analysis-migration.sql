-- Competitor analysis: daily cap (UTC) + one-time free trial + usage log
-- Run in Supabase → SQL Editor after content_posts migration.
-- Trial: when competitor_analysis_per_day = 0 and competitor_analysis_trial_used = false,
--        user may run one successful analysis; then trial flag is set server-side.

alter table public.profiles
  add column if not exists competitor_analysis_per_day integer;

alter table public.profiles
  add column if not exists competitor_analysis_trial_used boolean not null default false;

comment on column public.profiles.competitor_analysis_per_day is
  'Max competitor analysis runs per UTC day. NULL = unlimited. 0 = none until trial (once) or admin sets a plan.';

comment on column public.profiles.competitor_analysis_trial_used is
  'After the one complimentary analysis (while per-day limit is 0), set true server-side.';

update public.profiles
set competitor_analysis_per_day = 0
where competitor_analysis_per_day is null;

create table if not exists public.competitor_analysis_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists competitor_analysis_log_user_created
  on public.competitor_analysis_log (user_id, created_at desc);

-- New signups: trial available, no paid daily allowance until admin sets competitor_analysis_per_day
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
    competitor_analysis_trial_used
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
    false
  );
  return new;
end;
$$ language plpgsql security definer;
