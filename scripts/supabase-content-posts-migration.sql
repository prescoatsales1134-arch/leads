-- Content generation: daily cap per user + usage log
-- Run in Supabase → SQL Editor after trial_lifetime_limit exists on profiles.
-- If trial_lifetime_limit is missing, add it first (scripts/supabase-trial-lifetime-migration.sql).

alter table public.profiles
  add column if not exists content_posts_per_day integer;

comment on column public.profiles.content_posts_per_day is
  'Max content generation runs per UTC day. NULL = unlimited. 0 = none until admin sets a plan.';

update public.profiles
set content_posts_per_day = 0
where content_posts_per_day is null;

create table if not exists public.content_generation_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists content_generation_log_user_created
  on public.content_generation_log (user_id, created_at desc);

-- New signups: no paid content posts until admin sets content_posts_per_day
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role, lead_generation_limit, trial_lifetime_limit, content_posts_per_day)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'role', 'Manager'),
    0,
    100,
    0
  );
  return new;
end;
$$ language plpgsql security definer;
