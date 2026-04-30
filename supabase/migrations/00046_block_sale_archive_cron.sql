-- GDPR retention: anonymize applicant PII on block_sale_stands whose parent
-- block_sale ended more than 1 year ago. Runs daily at 04:00 UTC via pg_cron.
--
-- pg_cron is already enabled for this project (used by cancel-expired-bookings
-- in migration 00002). If for some reason it is not, enable it via the Supabase
-- dashboard → Database → Extensions before applying this migration.
--
-- Verification: select extname from pg_extension where extname = 'pg_cron';

-- SQL function that performs the anonymization directly (no net.http_post /
-- pg_net dependency). Equivalent to the block-sale-archive Edge Function but
-- runs inside the database transaction, which is simpler and more reliable.

create or replace function public.anonymize_old_block_sale_stands()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  cutoff date;
  old_ids uuid[];
  anonymized_count integer;
begin
  cutoff := (current_date - interval '1 year')::date;

  select array_agg(id) into old_ids
  from public.block_sales
  where end_date < cutoff;

  if old_ids is null or array_length(old_ids, 1) = 0 then
    return 0;
  end if;

  update public.block_sale_stands
  set
    applicant_email = '',
    applicant_name  = '',
    edit_token      = '',
    updated_at      = now()
  where block_sale_id = any(old_ids)
    and applicant_email <> '';

  get diagnostics anonymized_count = row_count;
  return anonymized_count;
end;
$$;

-- Run daily at 04:00 UTC. Anonymize personuppgifter on stands whose
-- parent event ended over 1 year ago.
select cron.schedule(
  'block_sale_archive_daily',
  '0 4 * * *',
  $$select public.anonymize_old_block_sale_stands()$$
);
