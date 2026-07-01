-- ============================================
-- STACKT MOMENTS — Full Supabase Migration
-- Paste this entire file into Supabase SQL Editor and Run
-- ============================================

-- PROFILES
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  plan text not null default 'free' check (plan in ('free', 'plus', 'pro')),
  created_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "Users can read own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- EVENTS
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  date date,
  slug text unique not null,
  brand_color text default '#FF7A1A',
  logo_url text,
  moderation_enabled boolean default false,
  active_window_end timestamptz,
  max_uploads integer default 50,
  retention_days integer default 7,
  created_at timestamptz default now()
);
alter table events enable row level security;
create policy "Hosts can crud own events" on events for all using (auth.uid() = host_id);
create policy "Anyone can read events by slug" on events for select using (true);

-- UPLOADS
create table if not exists uploads (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  file_url text not null,
  file_type text not null check (file_type in ('photo', 'video')),
  caption text,
  uploader_name text,
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  uploaded_at timestamptz default now()
);
alter table uploads enable row level security;
create policy "Anyone can insert uploads" on uploads for insert with check (true);
create policy "Anyone can read approved uploads" on uploads for select using (status = 'approved');
create policy "Hosts can read all uploads for their events" on uploads for select
  using (exists (select 1 from events where events.id = uploads.event_id and events.host_id = auth.uid()));
create policy "Hosts can update upload status" on uploads for update
  using (exists (select 1 from events where events.id = uploads.event_id and events.host_id = auth.uid()));
create policy "Hosts can delete uploads" on uploads for delete
  using (exists (select 1 from events where events.id = uploads.event_id and events.host_id = auth.uid()));

-- Enable realtime on uploads
alter publication supabase_realtime add table uploads;

-- STORAGE BUCKET
insert into storage.buckets (id, name, public)
values ('event-media', 'event-media', true)
on conflict (id) do nothing;

create policy "Anyone can upload media" on storage.objects
  for insert with check (bucket_id = 'event-media');
create policy "Anyone can read media" on storage.objects
  for select using (bucket_id = 'event-media');
create policy "Hosts can delete their event media" on storage.objects
  for delete using (bucket_id = 'event-media' and auth.role() = 'authenticated');
