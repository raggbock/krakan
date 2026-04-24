-- 00021_takeover_verification.sql
-- Adds 6-digit verification code support to business_owner_tokens.
-- The code is the second factor: token URL identifies the market,
-- email + code proves the owner controls the email inbox.

alter table public.business_owner_tokens
  add column verification_email text,
  add column verification_code_hash text,
  add column verification_code_expires_at timestamptz,
  add column verification_attempts smallint not null default 0;

-- Helps lookup by token_hash + email during verify.
create index business_owner_tokens_verify_idx
  on public.business_owner_tokens (token_hash, verification_email)
  where used_at is null and invalidated_at is null;
