alter table public.money_debts
  add column if not exists start_month_key text not null default '2026-09' check (start_month_key ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  add column if not exists monthly_plan_history jsonb not null default '{}'::jsonb;

update public.money_debts
set monthly_plan_history = jsonb_build_object(start_month_key, monthly_plan)
where monthly_plan_history = '{}'::jsonb;

create or replace function public.money_create_month(p_month_key text)
returns uuid
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_month_id uuid;
  v_first date;
begin
  if not public.money_allowed_user() then raise exception 'Not authorized'; end if;
  if p_month_key !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'Invalid month'; end if;
  if p_month_key < '2026-09' then raise exception 'Money Plan starts in September 2026'; end if;

  insert into public.money_months(user_id, month_key)
  values (v_uid, p_month_key)
  on conflict (user_id, month_key) do update set month_key=excluded.month_key
  returning id into v_month_id;

  v_first := to_date(p_month_key || '-01','YYYY-MM-DD');

  insert into public.money_month_items(user_id, month_id, item_id, category_id, name_snapshot, category_snapshot, planned_amount, due_date)
  select v_uid, v_month_id, i.id, i.category_id, i.name,
         coalesce(c.name,'Other'), i.default_planned_amount,
         case when i.due_day is null then null else
           make_date(extract(year from v_first)::int, extract(month from v_first)::int,
             least(i.due_day, extract(day from (date_trunc('month',v_first) + interval '1 month - 1 day'))::int)) end
  from public.money_items i
  left join public.money_categories c on c.id=i.category_id
  where i.user_id=v_uid and i.is_active and i.is_recurring
  on conflict (month_id,item_id) do nothing;

  update public.money_debts
  set monthly_plan_history = monthly_plan_history || jsonb_build_object(p_month_key, monthly_plan)
  where user_id=v_uid
    and start_month_key <= p_month_key
    and not (monthly_plan_history ? p_month_key);

  return v_month_id;
end;
$$;

create or replace function public.money_record_payment(
  p_month_id uuid,
  p_payment_type text,
  p_amount numeric,
  p_payment_date date,
  p_month_item_id uuid default null,
  p_debt_id uuid default null,
  p_note text default null
)
returns table(payment_id uuid, effective_amount numeric, debt_balance numeric)
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_effective numeric(12,2);
  v_balance numeric(12,2);
  v_payment uuid;
  v_month_key text;
begin
  if not public.money_allowed_user() then raise exception 'Not authorized'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
  if p_payment_type not in ('expense','debt') then raise exception 'Invalid payment type'; end if;

  select month_key into v_month_key
  from public.money_months
  where id=p_month_id and user_id=v_uid;
  if not found then raise exception 'Invalid month'; end if;
  if to_char(p_payment_date,'YYYY-MM') <> v_month_key then raise exception 'Payment date must be inside the selected month'; end if;

  if p_payment_type='expense' then
    if p_month_item_id is null or p_debt_id is not null then raise exception 'Expense payment requires month item only'; end if;
    if not exists(select 1 from public.money_month_items where id=p_month_item_id and month_id=p_month_id and user_id=v_uid) then raise exception 'Invalid month item'; end if;
    v_effective := round(p_amount,2);
    v_balance := null;
  else
    if p_debt_id is null or p_month_item_id is not null then raise exception 'Debt payment requires debt only'; end if;
    select current_balance into v_balance
    from public.money_debts
    where id=p_debt_id and user_id=v_uid and is_active and start_month_key <= v_month_key
    for update;
    if not found then raise exception 'Invalid debt'; end if;
    if v_balance <= 0 then raise exception 'Debt is already paid'; end if;
    v_effective := least(round(p_amount,2),v_balance);
    v_balance := round(v_balance-v_effective,2);
    update public.money_debts
      set current_balance=v_balance, is_active=(v_balance>0)
      where id=p_debt_id and user_id=v_uid;
  end if;

  insert into public.money_payments(user_id,month_id,month_item_id,debt_id,payment_type,amount,payment_date,note)
  values(v_uid,p_month_id,p_month_item_id,p_debt_id,p_payment_type,v_effective,p_payment_date,nullif(trim(p_note),''))
  returning id into v_payment;

  return query select v_payment,v_effective,v_balance;
end;
$$;
