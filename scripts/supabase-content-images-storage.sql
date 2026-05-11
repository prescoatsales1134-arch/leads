-- Content card images: public Storage bucket + content_posts table
-- Run once in Supabase → SQL Editor after auth/profiles exist.

-- 1) Bucket: public so getPublicUrl() works for share/download
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-images',
  'content-images',
  true,
  10485760,
  array['image/png']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2) Anyone can read objects (bucket is public)
drop policy if exists "Public read content-images" on storage.objects;
create policy "Public read content-images"
  on storage.objects
  for select
  to public
  using (bucket_id = 'content-images');

-- 3) Persist final image URL per generated card
create table if not exists public.content_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  headline text,
  image_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists content_posts_user_created_idx
  on public.content_posts (user_id, created_at desc);

alter table public.content_posts enable row level security;

drop policy if exists "Users read own content_posts" on public.content_posts;
create policy "Users read own content_posts"
  on public.content_posts
  for select
  using (auth.uid() = user_id);

-- Backend inserts use service role (bypasses RLS). No INSERT policy required for server-only writes.
