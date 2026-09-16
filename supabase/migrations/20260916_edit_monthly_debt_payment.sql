create or replace function public.money_edit_debt_month(
  p_debt_id uuid,
  p_month_id uuid,
  p_name text,
  p_debt_type text,
  p_total_amount numeric,
  p_monthly_plan numeric,
  p_apr numeric,
  p_month_payment numeric,
  p_payment_date date
)
returns table(effective_payment numeric, debt_balance numeric, reversed_count integer)
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_month_key text;
  v_paid_other numeric(12,2) := 0;
  v_effective numeric(12,2) := 0;
  v_balance numeric(12,2) := 0;
  v_reversed integer := 0;
  v_history jsonb := '{}'::jsonb;
begin
  if not public.money_allowed_user() then raise exception 'Not authorized'; end if;
  if p_debt_type not in ('loan','credit') then raise exception 'Invalid debt type'; end if;
  if p_total_amount is null or p_total_amount < 0 then raise exception 'Total amount must be zero or greater'; end if;
  if coalesce(p_month_payment,0) < 0 then raise exception 'Monthly payment cannot be negative'; end if;

  select month_key into v_month_key
  from public.money_months
  where id = p_month_id and user_id = v_uid;
  if not found then raise exception 'Invalid month'; end if;
  if to_char(p_payment_date,'YYYY-MM') <> v_month_key then raise exception 'Payment date must be inside the selected month'; end if;

  perform 1 from public.money_debts
  where id = p_debt_id and user_id = v_uid and start_month_key <= v_month_key
  for update;
  if not found then raise exception 'Debt not found'; end if;

  update public.money_payments
     set reversed_at = now(),
         reversal_reason = 'Edited monthly payment'
   where user_id = v_uid
     and debt_id = p_debt_id
     and month_id = p_month_id
     and payment_type = 'debt'
     and reversed_at is null;
  get diagnostics v_reversed = row_count;

  select coalesce(sum(amount),0)::numeric(12,2)
    into v_paid_other
    from public.money_payments
   where user_id = v_uid
     and debt_id = p_debt_id
     and payment_type = 'debt'
     and reversed_at is null;

  if round(p_total_amount,2) < v_paid_other then
    raise exception 'Total amount cannot be below payments already made in other months';
  end if;

  v_effective := least(round(coalesce(p_month_payment,0),2), round(p_total_amount,2) - v_paid_other);
  v_balance := round(round(p_total_amount,2) - v_paid_other - v_effective,2);

  select coalesce(monthly_plan_history,'{}'::jsonb)
    into v_history
    from public.money_debts
   where id = p_debt_id and user_id = v_uid;

  update public.money_debts
     set name = trim(p_name),
         debt_type = p_debt_type,
         opening_balance = round(p_total_amount,2),
         current_balance = v_balance,
         monthly_plan = round(coalesce(p_monthly_plan,0),2),
         monthly_plan_history = v_history || jsonb_build_object(v_month_key, round(coalesce(p_monthly_plan,0),2)),
         apr = case when p_apr is null then null else round(p_apr,2) end,
         is_active = (v_balance > 0)
   where id = p_debt_id and user_id = v_uid;

  if v_effective > 0 then
    insert into public.money_payments(user_id,month_id,debt_id,payment_type,amount,payment_date,note)
    values(v_uid,p_month_id,p_debt_id,'debt',v_effective,p_payment_date,'Monthly payment edited');
  end if;

  return query select v_effective, v_balance, v_reversed;
end;
$$;

revoke all on function public.money_edit_debt_month(uuid,uuid,text,text,numeric,numeric,numeric,numeric,date) from public, anon;
grant execute on function public.money_edit_debt_month(uuid,uuid,text,text,numeric,numeric,numeric,numeric,date) to authenticated;
