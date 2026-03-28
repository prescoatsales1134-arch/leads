# Complete Supabase Setup Guide

This guide walks you through setting up Supabase for the Lead Generation Dashboard: project creation, Google sign-in, redirect URLs, and optional role storage.

---

## Which queries to run on Supabase

You only need to run SQL if you use the **profiles table** for roles (Option B below). If you set roles in **User Metadata** only (Option A), you don’t run any queries.

**Run these in the Supabase dashboard: SQL Editor.**

### Query 1: Create `profiles` table, RLS, and signup trigger (run once)

Run this whole block once. It creates the `profiles` table, enables RLS, adds policies so users can read/update their own profile and Admins can view/update all profiles, and adds a trigger that creates a profile row when a new user signs up.

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

-- RLS: users can read their own profile
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Admins can view all profiles (for Settings → Manage users)
create policy "Admins can view all profiles"
  on public.profiles for select
  using ( (select role from public.profiles where id = auth.uid()) = 'Admin' );

-- Admins can update any profile's role (for Settings → Manage users)
create policy "Admins can update any profile"
  on public.profiles for update
  using ( (select role from public.profiles where id = auth.uid()) = 'Admin' );

-- Trigger to create profile on signup (new managers get lead_generation_limit = 0)
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

### Query 2: Make an existing user an Admin (run per user)

For each user who should be **Admin**, run this **once** after replacing the placeholders:

- `USER_UUID_HERE` → the user’s UUID (from **Authentication** → **Users** → copy **UID**).
- `user@example.com` → that user’s email.

```sql
insert into public.profiles (id, email, role)
values ('USER_UUID_HERE', 'user@example.com', 'Admin')
on conflict (id) do update set role = excluded.role;
```

Example:

```sql
insert into public.profiles (id, email, role)
values ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'admin@mycompany.com', 'Admin')
on conflict (id) do update set role = excluded.role;
```

### Query 3: Create `activity_log` table (optional, for Admin activity view)

Run this once if you want **Settings → Activity log** to show per-user actions (generate leads, sync to HubSpot, export CSV). The app server writes to this table; only Admins can read it via the dashboard.

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

-- No policies: only the server (service_role) reads/writes. Client cannot access this table directly.
```

### Query 4: Create `user_leads` table (per-user lead history)

Run this once so the **Leads** page shows each user’s saved leads across sessions. The app stores leads here when you generate them and loads them when you open the dashboard.

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
  created_at timestamptz default now(),
  unique (user_id, lead_id)
);

create index user_leads_user_created on public.user_leads (user_id, created_at desc);

alter table public.user_leads enable row level security;

-- RLS: users can only see and manage their own rows (server uses service_role and bypasses RLS)
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

**Note:** The app server uses Supabase with the **service_role** key, so it **bypasses RLS**. RLS does not cause leads to disappear; the server never deletes rows. If the table stays empty, leads are not being saved—usually because the save request failed (e.g. session expired). After generating leads, if you see a toast like "Leads not saved — please sign in again", sign in again and generate once more; the app will then persist them.

**If you already created `user_leads` before the "Scraped" timestamp was added**, run this once to add the column:

```sql
ALTER TABLE public.user_leads ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
CREATE INDEX IF NOT EXISTS user_leads_user_created ON public.user_leads (user_id, created_at desc);
```

**If you already created `user_leads` and need the company domain column**, run this once:

```sql
ALTER TABLE public.user_leads ADD COLUMN IF NOT EXISTS company_domain text;
```

**If you already have `user_leads` and need the LinkedIn URL column**, run this once:

```sql
ALTER TABLE public.user_leads ADD COLUMN IF NOT EXISTS linkedin text;
```

**If you want admins to set a monthly lead generation limit per user**, run this once to add the column to `profiles`:

```sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lead_generation_limit integer;
-- New managers get 0 leads/month by default. Run the trigger update in Query 1 so new signups get 0.
ALTER TABLE public.profiles ALTER COLUMN lead_generation_limit SET DEFAULT 0;
```

- `NULL` or empty = unlimited. **New users** (created by the signup trigger) get **0** unless you change the trigger.
- **To make new signups get default 0**, update the trigger so it sets `lead_generation_limit` (see Query 1: the trigger inserts with `0` for new users). If your trigger was created before this, run the full `create or replace function public.handle_new_user() ...` from Query 1 again so it includes `lead_generation_limit = 0`.
- A number (e.g. `50`) = that user can generate at most that many leads per calendar month; the count resets automatically at the start of each month.
- In **Settings → Manage users**, admins see a **Lead limit /month** column and can set a number or leave it empty (unlimited). **Save** updates both Role and Lead limit.

New users who sign up after the trigger is in place get a row in `profiles` automatically with role **Manager**.

**Do you have to run these queries every time?**

- **No.** You run **Query 1** once to set up the table and **Query 2** only to make the *first* Admin(s) (e.g. yourself).
- **After that, the dashboard handles everything.** Any user with role **Admin** sees **Settings → Manage users**: a table of all users with a **Role** dropdown (Admin / Manager) and a **Save** button per row. Changing the dropdown and clicking Save updates the role in Supabase—no SQL needed. Admins can promote Manager → Admin or demote Admin → Manager from the dashboard at any time.

---

## 1. Create a Supabase project

1. Go to **[supabase.com](https://supabase.com)** and sign in (or create an account).
2. Click **New project**.
3. Choose your **Organization** (or create one).
4. Fill in:
   - **Name:** e.g. `lead-gen-dashboard`
   - **Database password:** create a strong password and store it safely (needed for DB access).
   - **Region:** pick the one closest to your users.
5. Click **Create new project** and wait until the project is ready.

---

## 2. Get your API keys and URL

1. In the Supabase dashboard, open your project.
2. Go to **Project Settings** (gear icon in the left sidebar).
3. Open **API** in the settings menu.
4. Copy and save:
   - **Project URL** (e.g. `https://xxxxxxxxxxxxx.supabase.co`)
   - **anon public** key (under "Project API keys")

**Two keys:**  
- **anon public** — Used in the browser (and in `/api/env`). The app creates a single shared Supabase client with this key; after sign-in, all auth and data use that client with the user’s session; RLS limits access.  
- **service_role** — Used only in **server.js** (from `.env`). That server-side client bypasses RLS and is used when the backend must act on Supabase on behalf of the app (e.g. server-side APIs). Never put the service_role key in the frontend or in `/api/env`. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env` if you add server routes that need it.

**Sign in with Google** is set up in the next step: see [§3 Enable Google sign-in (OAuth)](#3-enable-google-sign-in-oauth) for creating Google OAuth credentials and enabling the Google provider in Supabase.

Add them to your `.env`:

```env
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Then run:

```bash
node scripts/generate-config.js
```

---

## 3. Enable Google sign-in (OAuth)

### 3.1 Create Google OAuth credentials

1. Open **[Google Cloud Console](https://console.cloud.google.com/)**.
2. Create or select a **Project**.
3. Go to **APIs & Services** → **Credentials**.
4. Click **Create credentials** → **OAuth client ID**.
5. If asked, configure the **OAuth consent screen**:
   - User type: **External** (or Internal for workspace-only).
   - App name: e.g. **Lead Gen Dashboard**.
   - Add your email under **Support email**.
   - Save.
6. Back in **Create OAuth client ID**:
   - Application type: **Web application**.
   - Name: e.g. **Lead Gen Web**.
   - **Authorized JavaScript origins:**
     - For local dev: `http://localhost:3000`, `http://127.0.0.1:3000` (use the port your app uses).
     - For production: `https://yourdomain.com`.
   - **Authorized redirect URIs:** add this exact URL (replace with your Supabase project ref from the Supabase URL):
     ```
     https://xxxxxxxxxxxxx.supabase.co/auth/v1/callback
     ```
     You find the project ref in your Supabase URL: `https://<PROJECT_REF>.supabase.co`.
7. Click **Create** and copy the **Client ID** and **Client Secret**.

### 3.2 Add Google provider in Supabase

1. In Supabase: **Authentication** → **Providers**.
2. Find **Google** and turn it **ON**.
3. Paste:
   - **Client ID** (from Google Cloud).
   - **Client Secret** (from Google Cloud).
4. Save.

### 3.3 Enable Email sign-in (for email/password and sign-up)

The app supports **email + password** login and **sign up**. Use the built-in Email provider:

1. In Supabase: **Authentication** → **Providers**.
2. Find **Email** and ensure it is **ON** (it is usually on by default).
3. Optional: under **Email**, you can turn on **Confirm email** so new users must confirm their address before signing in. If you leave it off, they can sign in immediately after sign-up.

No extra OAuth setup is needed for email/password; the **anon** key is enough.

---

## 4. Set redirect URLs for your app

After Google sign-in, Supabase redirects the user to your **backend** callback URL; the app then sets a session cookie and redirects to the dashboard. You must add the callback URL in Supabase.

1. In Supabase: **Authentication** → **URL Configuration**.
2. Under **Redirect URLs**, add the backend auth callback URL (not the dashboard URL), for example:
   - Local: `http://localhost:3000/auth/callback` (or `http://127.0.0.1:3000/auth/callback`).
   - Production: `https://yourdomain.com/auth/callback`.
3. You can add multiple lines (one per URL).
4. **Site URL** can be set to the same as your main app URL (e.g. `http://localhost:3000` or `https://yourdomain.com`). This is used when no explicit redirect is given.
5. Save.

Important: the URL must match how you open the app (protocol, host, port, path). If you use a different port (e.g. 5000), add `http://localhost:5000/dashboard.html`.

---

## 5. (Optional) Store user roles in a `profiles` table

The app supports roles **Admin** and **Manager**. You can store them in Supabase in two ways.

### Option A: Use Supabase metadata (no extra table)

- Set the role when inviting or creating users, or via Supabase Dashboard.
- In **Authentication** → **Users** → select a user → **Edit**.
- Under **User Metadata** add: `"role": "Admin"` or `"role": "Manager"`.

The app reads `user_metadata.role` or `app_metadata.role`; if missing, it falls back to **Manager**.

### Option B: Use a `profiles` table (recommended if you manage many users)

1. In Supabase go to **SQL Editor**.
2. Run this SQL:

```sql
-- Table to store user profile and role
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  full_name text,
  role text check (role in ('Admin', 'Manager')) default 'Manager',
  updated_at timestamptz default now()
);

-- RLS: users can read their own profile
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Only service role or an admin should update; for simplicity allow own row update
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Admins can view all profiles (for Settings → Manage users)
create policy "Admins can view all profiles"
  on public.profiles for select
  using ( (select role from public.profiles where id = auth.uid()) = 'Admin' );

-- Admins can update any profile's role (for Settings → Manage users)
create policy "Admins can update any profile"
  on public.profiles for update
  using ( (select role from public.profiles where id = auth.uid()) = 'Admin' );

-- Optional: trigger to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'role', 'Manager')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

3. **Assign roles** for existing users (run in SQL Editor, replace the UUID):

```sql
insert into public.profiles (id, email, role)
values ('USER_UUID_HERE', 'user@example.com', 'Admin')
on conflict (id) do update set role = excluded.role;
```

To get a user’s UUID: **Authentication** → **Users** → copy the user’s **UID**.

---

## 6. Quick checklist

- [ ] Supabase project created  
- [ ] `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env`  
- [ ] `node scripts/generate-config.js` run so `config.js` exists  
- [ ] Google OAuth client created (Client ID + Secret)  
- [ ] Google provider enabled in Supabase with same Client ID/Secret  
- [ ] Supabase redirect URL added (e.g. `http://localhost:3000/auth/callback`)  
- [ ] Role set via **User Metadata** (Option A) or **profiles** table (Option B)  

---

## 7. Test the flow

1. Serve the app (e.g. `npx serve .` in the project folder).
2. Open the URL you added as redirect (e.g. `http://localhost:3000`).
3. You should see the login page; click **Sign in with Google**.
4. After Google consent, you should be redirected to `dashboard.html` and see the dashboard with your email and role badge.

If redirect fails, double-check:

- **Redirect URLs** in Supabase (Auth → URL Configuration) include your callback URL exactly (e.g. `http://localhost:3000/auth/callback`).
- **Authorized JavaScript origins** in Google Cloud include your app origin (e.g. `http://localhost:3000`).
- **Authorized redirect URIs** in Google Cloud include `https://<PROJECT_REF>.supabase.co/auth/v1/callback`.

---

## 8. Security notes

- Use only the **anon** key in the browser (it’s public). Never put the **service_role** key in frontend code.
- Restrict what the anon key can do via **Row Level Security (RLS)** on any tables you add.
- In production, use HTTPS and add your real domain to Supabase redirect URLs and Google OAuth origins.
