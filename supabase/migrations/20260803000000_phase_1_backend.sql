-- PSA Valencia — Phase 1: Supabase backend, access control and Storage.
-- Run with `supabase db push` or paste into the Supabase SQL editor.

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('administrator', 'photographer', 'editor', 'user');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'user',
  assigned_at timestamptz not null default now()
);

create table if not exists public.site_content (
  content_key text primary key check (char_length(content_key) between 1 and 120),
  content_value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.site_visits (
  id bigint generated always as identity primary key,
  page_path text not null check (char_length(page_path) <= 512),
  page_title text check (char_length(page_title) <= 200),
  session_id text not null check (char_length(session_id) <= 100),
  referrer text check (char_length(referrer) <= 300),
  user_agent text check (char_length(user_agent) <= 300),
  language text check (char_length(language) <= 16),
  visited_at timestamptz not null default now()
);

create index if not exists site_visits_visited_at_idx on public.site_visits (visited_at desc);
create index if not exists site_visits_session_id_idx on public.site_visits (session_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists site_content_set_updated_at on public.site_content;
create trigger site_content_set_updated_at before update on public.site_content
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email))
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.has_role(required_role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = required_role
  );
$$;

create or replace function public.has_any_role(required_roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = any(required_roles)
  );
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_any_role(array['administrator', 'editor']::public.app_role[]);
$$;

revoke all on function public.has_role(public.app_role) from public;
revoke all on function public.has_any_role(public.app_role[]) from public;
revoke all on function public.is_staff() from public;
grant execute on function public.has_role(public.app_role) to authenticated;
grant execute on function public.has_any_role(public.app_role[]) to authenticated;
grant execute on function public.is_staff() to authenticated;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.site_content enable row level security;
alter table public.site_visits enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "Admins manage profiles" on public.profiles;
create policy "Administrators manage profiles" on public.profiles for all to authenticated using (public.has_role('administrator')) with check (public.has_role('administrator'));

drop policy if exists "Users read own role" on public.user_roles;
create policy "Users read own role" on public.user_roles for select to authenticated using (user_id = auth.uid());
drop policy if exists "Admins manage roles" on public.user_roles;
create policy "Administrators manage roles" on public.user_roles for all to authenticated using (public.has_role('administrator')) with check (public.has_role('administrator'));

drop policy if exists "Public reads published content" on public.site_content;
create policy "Public reads published content" on public.site_content for select to anon, authenticated using (true);
drop policy if exists "Authenticated write site content" on public.site_content;
drop policy if exists "Staff manages site content" on public.site_content;
create policy "Administrators and editors manage site content" on public.site_content for all to authenticated using (public.has_any_role(array['administrator', 'editor']::public.app_role[])) with check (public.has_any_role(array['administrator', 'editor']::public.app_role[]));

drop policy if exists "Public creates visits" on public.site_visits;
create policy "Public creates visits" on public.site_visits for insert to anon, authenticated with check (true);
drop policy if exists "Staff reads visits" on public.site_visits;
create policy "Administrators and editors read visits" on public.site_visits for select to authenticated using (public.has_any_role(array['administrator', 'editor']::public.app_role[]));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('photos', 'photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('processed', 'processed', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('news', 'news', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('documents', 'documents', false, 52428800, array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public reads media" on storage.objects;
create policy "Public reads media" on storage.objects for select to anon, authenticated using (bucket_id in ('photos', 'processed', 'news', 'avatars'));
drop policy if exists "Administrators manage all media" on storage.objects;
create policy "Administrators manage all media" on storage.objects for all to authenticated using (bucket_id in ('photos', 'processed', 'news', 'avatars', 'documents') and public.has_role('administrator')) with check (bucket_id in ('photos', 'processed', 'news', 'avatars', 'documents') and public.has_role('administrator'));
drop policy if exists "Photographers manage photos" on storage.objects;
create policy "Photographers manage photos" on storage.objects for all to authenticated using (bucket_id in ('photos', 'processed') and public.has_role('photographer')) with check (bucket_id in ('photos', 'processed') and public.has_role('photographer'));
drop policy if exists "Editors manage published media" on storage.objects;
create policy "Editors manage published media" on storage.objects for all to authenticated using (bucket_id in ('processed', 'news', 'documents') and public.has_role('editor')) with check (bucket_id in ('processed', 'news', 'documents') and public.has_role('editor'));
drop policy if exists "Users manage own avatar" on storage.objects;
create policy "Users manage own avatar" on storage.objects for all to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Bootstrap exactly one administrator after creating the account in Auth:
-- insert into public.user_roles (user_id, role)
-- values ('AUTH_USER_UUID', 'administrator')
-- on conflict (user_id) do update set role = excluded.role, assigned_at = now();
