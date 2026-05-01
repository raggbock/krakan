-- Fix 00046: anonymize_old_block_sale_stands referenced a non-existent
-- updated_at column. Recreate without that column.

create or replace function public.anonymize_old_block_sale_stands()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_cutoff date := (now() - interval '1 year')::date;
begin
  with anon as (
    update public.block_sale_stands
    set applicant_email = '',
        applicant_name = '',
        edit_token = ''
    where applicant_email <> ''
      and block_sale_id in (
        select id from public.block_sales where end_date < v_cutoff
      )
    returning 1
  )
  select count(*) into v_count from anon;
  return v_count;
end;
$$;
