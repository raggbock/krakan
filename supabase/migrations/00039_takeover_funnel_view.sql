-- Per-market takeover funnel view. Joins business_owner_tokens against
-- flea_markets so admin can sort by recently-sent + see which sites are
-- stuck at each step.
--
-- One row per active token. Excludes invalidated/used/expired so the
-- view always shows the "alive" pipeline — once admin re-issues a
-- replacement token, the old one disappears here automatically.
create or replace view public.takeover_funnel as
select
  t.id as token_id,
  t.flea_market_id,
  fm.name as market_name,
  fm.slug as market_slug,
  fm.city,
  t.sent_to_email,
  t.sent_at,
  t.clicked_at,
  t.verification_email is not null as email_submitted,
  t.verification_code_hash is not null as code_sent,
  t.verification_attempts,
  t.expires_at,
  t.priority,
  case
    when t.clicked_at is null then 'never_clicked'
    when t.verification_email is null then 'clicked_only'
    when t.verification_code_hash is null then 'email_no_code'
    else 'code_sent_unverified'
  end as stage,
  extract(epoch from (now() - t.sent_at))/86400 as days_since_sent
from public.business_owner_tokens t
join public.flea_markets fm on fm.id = t.flea_market_id
where t.used_at is null
  and t.invalidated_at is null
  and t.expires_at > now()
  and fm.is_deleted = false;

grant select on public.takeover_funnel to service_role;

comment on view public.takeover_funnel is
  'Active takeover tokens with their funnel stage. Driven by '
  'business_owner_tokens timestamps; once a token is used or '
  'invalidated it drops out of the view.';
