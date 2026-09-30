-- Fix loan/credit undo so the balance is restored from payment history.
-- This avoids relying on a possibly stale current_balance value.
create or replace function public.money_reverse_payment(p_payment_id uuid, p_reason text)
returns numeric
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_payment public.money_payments%rowtype;
  v_balance numeric(12,2);
begin
  if not public.money_allowed_user() then raise exception 'Not authorized'; end if;

  select * into v_payment
  from public.money_payments
  where id = p_payment_id and user_id = v_uid
  for update;

  if not found then raise exception 'Payment not found'; end if;
  if v_payment.reversed_at is not null then raise exception 'Payment already reversed'; end if;

  update public.money_payments
  set reversed_at = now(),
      reversal_reason = coalesce(nullif(trim(p_reason), ''), 'Correction')
  where id = p_payment_id and user_id = v_uid;

  if v_payment.payment_type = 'debt' then
    update public.money_debts d
    set current_balance = round(
          greatest(
            0,
            d.opening_balance - coalesce((
              select sum(p.amount)
              from public.money_payments p
              where p.user_id = v_uid
                and p.debt_id = d.id
                and p.payment_type = 'debt'
                and p.reversed_at is null
            ), 0)
          ),
          2
        ),
        is_active = true
    where d.id = v_payment.debt_id
      and d.user_id = v_uid
    returning d.current_balance into v_balance;
  end if;

  return v_balance;
end;
$$;

revoke all on function public.money_reverse_payment(uuid,text) from public, anon;
grant execute on function public.money_reverse_payment(uuid,text) to authenticated;
