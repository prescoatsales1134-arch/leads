-- Run this in Supabase Dashboard → SQL Editor to set default lead limit to 0 for new signups.
-- New managers will get 0 leads/month until an admin increases their limit.

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role, lead_generation_limit)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'role', 'Manager'),
    0
  );
  return new;
end;
$$ language plpgsql security definer;

-- Optional: set existing Manager users' limit to 0 (uncomment to run)
-- update public.profiles set lead_generation_limit = 0 where role = 'Manager' and lead_generation_limit = 50;
