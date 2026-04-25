# SQL to run in your new Supabase project

Run these in **Supabase Dashboard → SQL Editor**, in order. Use a **new** project (replace the current one).

---

## 1. Profiles table + RLS + signup trigger (run once)

Creates `profiles` (role, lead limit), RLS, and a trigger so new signups get a profile with default role **Manager** and **0** leads/month (contact admin to increase).

```sql
-- Table to store user profile and role
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  full_name text,
  role text check (role in ('Admin', 'Manager')) default 'Manager',
  lead_generation_limit integer,
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using ( (select role from public.profiles where id = auth.uid()) = 'Admin' );

create policy "Admins can update any profile"
  on public.profiles for update
  using ( (select role from public.profiles where id = auth.uid()) = 'Admin' );

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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

---

## 2. Activity log table (optional; for Settings → Activity log)

Run once if you want the **Activity log** in Settings to work.

```sql
create table public.activity_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  user_email text,
  action text not null,
  details jsonb,
  created_at timestamptz default now()
);

create index activity_log_created_at on public.activity_log (created_at desc);

alter table public.activity_log enable row level security;
```

---

## 3. User leads table (per-user saved leads)

Run once so the **Leads** page can save and load leads.

```sql
create table public.user_leads (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id text not null,
  company_name text,
  contact_name text,
  job_title text,
  industry text,
  email text,
  phone text,
  linkedin text,
  company_domain text,
  country text,
  status text default 'New',
  lead_source text not null default 'linkedin' check (lead_source in ('linkedin', 'google')),
  created_at timestamptz default now(),
  unique (user_id, lead_id)
);

create index user_leads_user_created on public.user_leads (user_id, created_at desc);

alter table public.user_leads enable row level security;

create policy "Users can read own leads"
  on public.user_leads for select
  using (auth.uid() = user_id);
create policy "Users can insert own leads"
  on public.user_leads for insert
  with check (auth.uid() = user_id);
create policy "Users can update own leads"
  on public.user_leads for update
  using (auth.uid() = user_id);
create policy "Users can delete own leads"
  on public.user_leads for delete
  using (auth.uid() = user_id);
```

---

## 4. Make your user an Admin (run after you sign up once)

After you **sign up or log in once** in the app, go to **Authentication → Users**, copy your **UID**, then run this (replace the placeholders):

```sql
insert into public.profiles (id, email, role)
values ('YOUR_USER_UID_HERE', 'your@email.com', 'Admin')
on conflict (id) do update set role = excluded.role;
```

Example:

```sql
insert into public.profiles (id, email, role)
values ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'admin@mycompany.com', 'Admin')
on conflict (id) do update set role = excluded.role;
```

---

## Checklist

- [ ] **Query 1** – profiles + RLS + trigger  
- [ ] **Query 2** – activity_log (optional)  
- [ ] **Query 3** – user_leads + RLS  
- [ ] **Query 4** – make your user Admin (after first login, with your real UID and email)  

---

## After SQL: Auth and app config

1. **Auth → Providers** – Enable **Google** (or Email) and set Client ID/Secret if using Google.
2. **Auth → URL Configuration** – Add your app URL(s) to **Redirect URLs**, e.g.  
   `http://localhost:3001/auth/callback`  
   and your production URL when you deploy.
3. **Project Settings → API** – Copy **Project URL** and **anon** + **service_role** keys into your app’s `.env`:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

Then restart the app and sign in; new users will get a profile automatically, and you can promote yourself to Admin with Query 4.
