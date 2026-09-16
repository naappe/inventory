create or replace function public.money_bootstrap_september()
returns uuid
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_month_id uuid;
  v_names text[] := array['Credit','Family','Utilities','Food','Other','Loans','Home','Personal','Cosmetics','Transport'];
  v_name text;
  v_order int := 0;
begin
  if not public.money_allowed_user() then raise exception 'Not authorized'; end if;
  if exists(select 1 from public.money_months where user_id=v_uid) then
    select id into v_month_id from public.money_months where user_id=v_uid order by month_key limit 1;
    return v_month_id;
  end if;
  foreach v_name in array v_names loop
    insert into public.money_categories(user_id,name,display_order) values(v_uid,v_name,v_order)
    on conflict do nothing;
    v_order := v_order + 1;
  end loop;
  v_month_id := public.money_create_month('2026-09');
  return v_month_id;
end;
$$;
revoke all on function public.money_bootstrap_september() from public, anon;
grant execute on function public.money_bootstrap_september() to authenticated;
