-- ============================================
-- STACKT MOMENTS — Auto-expiry retention cron
-- Paste this entire file into Supabase SQL Editor and Run
-- (after supabase_migration.sql has already been applied)
-- ============================================

-- STEP 1 — Preview what this would delete right now, before enabling anything.
-- Nothing is deleted by running this — it's read-only.
select u.id, u.file_url, e.title, e.date, e.created_at, e.retention_days,
       coalesce(e.date, e.created_at::date) + (e.retention_days || ' days')::interval as expires_at
from uploads u
join events e on e.id = u.event_id
where coalesce(e.date, e.created_at::date) + (e.retention_days || ' days')::interval < now();

-- STEP 2 — Enable required extensions.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- STEP 3 — Store the credentials the cron job needs to call the Storage API.
-- Get these from Project Settings > API. The service_role key bypasses RLS —
-- treat it like a password, never put it in client-side code.
-- Replace the two placeholder values below, then run once.
select vault.create_secret('https://YOUR-PROJECT-REF.supabase.co', 'project_url');
select vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'service_role_key');

-- STEP 4 — The cleanup function itself.
-- Retention counts down from the event's date (falls back to created_at if no date was set).
create or replace function cleanup_expired_uploads()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  project_url text;
  service_key text;
  expired_paths text[];
begin
  select decrypted_secret into project_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into service_key from vault.decrypted_secrets where name = 'service_role_key';

  select array_agg(split_part(u.file_url, '/event-media/', 2))
  into expired_paths
  from uploads u
  join events e on e.id = u.event_id
  where coalesce(e.date, e.created_at::date) + (e.retention_days || ' days')::interval < now();

  if expired_paths is not null and array_length(expired_paths, 1) > 0 then
    -- Must go through the Storage API — deleting storage.objects rows directly
    -- via SQL leaves the actual files orphaned in the bucket (still billed).
    perform net.http_delete(
      url := project_url || '/storage/v1/object/event-media',
      headers := jsonb_build_object('Authorization', 'Bearer ' || service_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object('prefixes', expired_paths)
    );

    delete from uploads u
    using events e
    where e.id = u.event_id
      and coalesce(e.date, e.created_at::date) + (e.retention_days || ' days')::interval < now();
  end if;
end;
$$;

-- STEP 5 — Schedule it to run daily at 3am UTC.
select cron.schedule('cleanup-expired-uploads', '0 3 * * *', $$select cleanup_expired_uploads();$$);

-- To check scheduled jobs:      select * from cron.job;
-- To check run history:         select * from cron.job_run_details order by start_time desc limit 20;
-- To disable the cron job:      select cron.unschedule('cleanup-expired-uploads');
-- To run cleanup manually once: select cleanup_expired_uploads();
