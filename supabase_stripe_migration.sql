-- ============================================
-- STACKT MOMENTS — Stripe payment status columns
-- Paste this entire file into Supabase SQL Editor and Run
-- (after supabase_migration.sql has already been applied)
-- ============================================

alter table events
  add column if not exists payment_status text not null default 'paid'
    check (payment_status in ('pending', 'paid')),
  add column if not exists stripe_session_id text,
  add column if not exists plan text not null default 'free'
    check (plan in ('free', 'plus', 'pro'));

-- Free events are created already-paid (no checkout needed).
-- Plus/Pro events are inserted with payment_status = 'pending' and
-- flipped to 'paid' by the /api/stripe-webhook function once Stripe
-- confirms the checkout session completed.

create unique index if not exists events_stripe_session_id_idx
  on events (stripe_session_id)
  where stripe_session_id is not null;
