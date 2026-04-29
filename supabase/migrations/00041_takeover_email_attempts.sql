-- Server-side telemetry for the takeover claim flow.
--
-- Today we stamp clicked_at (page-load via takeover-info) and used_at
-- (successful claim via claim_takeover_atomic) but nothing in between.
-- That means we can't tell whether the 18-of-24 visitors who bounced
-- after clicking ever even tried to submit the form, or whether they
-- tried with the wrong email and got rejected.
--
-- These two columns plug that gap. Stamped from takeover-start on every
-- attempt — service-role write, no consent gate, independent of
-- PostHog. last_failure_code holds null on success, otherwise the
-- canonical HttpError code (email_mismatch / token_already_used / etc).

alter table public.business_owner_tokens
  add column if not exists email_attempt_at timestamptz,
  add column if not exists email_attempt_count int not null default 0,
  add column if not exists last_failure_code text;

comment on column public.business_owner_tokens.email_attempt_at is
  'Timestamp of the most recent takeover-start call (success or failure). '
  'Lets the funnel separate "clicked but never tried" from "tried and bounced".';

comment on column public.business_owner_tokens.email_attempt_count is
  'How many times takeover-start was called for this token. 0 = never tried, '
  '>1 = visitor retried (likely fixed an email-mismatch).';

comment on column public.business_owner_tokens.last_failure_code is
  'Null on success; otherwise the HttpError code thrown by takeover-start '
  '(email_mismatch / token_already_used / market_removed / etc).';
