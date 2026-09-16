create or replace function public.money_create_receivable(
  p_month_id uuid,
  p_name text,
  p_amount numeric,
  p_transaction_date date,
  p_expected_repayment_date date default null,
  p_remarks text default null
)
returns table(receivable_id uuid, transaction_id uuid, receivable_balance numeric)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_month_key text;
  v_receivable uuid;
  v_transaction uuid;
  v_amount numeric(14,2);
begin
  if v_user is null or not public.money_allowed_user() then
    raise exception 'Not authorized';
  end if;
  v_amount := round(coalesce(p_amount,0)::numeric,2);
  if v_amount <= 0 then raise exception 'Amount must be greater than zero'; end if;
  if nullif(trim(p_name),'') is null then raise exception 'Borrower name is required'; end if;

  select month_key into v_month_key
  from public.money_months
  where id = p_month_id and user_id = v_user;
  if v_month_key is null then raise exception 'Month not found'; end if;

  insert into public.money_receivables(
    user_id,name,opening_balance,current_balance,expected_repayment_date,remarks,is_active,start_month_key
  ) values (
    v_user,trim(p_name),v_amount,v_amount,p_expected_repayment_date,nullif(trim(coalesce(p_remarks,'')),''),true,v_month_key
  ) returning id into v_receivable;

  insert into public.money_receivable_transactions(
    user_id,receivable_id,month_id,transaction_type,amount,transaction_date,remarks
  ) values (
    v_user,v_receivable,p_month_id,'lend',v_amount,p_transaction_date,nullif(trim(coalesce(p_remarks,'')),'')
  ) returning id into v_transaction;

  return query select v_receivable,v_transaction,v_amount;
end;
$$;

create or replace function public.money_record_receivable_repayment(
  p_receivable_id uuid,
  p_month_id uuid,
  p_amount numeric,
  p_transaction_date date,
  p_remarks text default null
)
returns table(transaction_id uuid, receivable_balance numeric, effective_amount numeric)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_balance numeric(14,2);
  v_effective numeric(14,2);
  v_transaction uuid;
begin
  if v_user is null or not public.money_allowed_user() then raise exception 'Not authorized'; end if;
  if coalesce(p_amount,0) <= 0 then raise exception 'Amount must be greater than zero'; end if;
  if not exists(select 1 from public.money_months where id=p_month_id and user_id=v_user) then raise exception 'Month not found'; end if;

  select current_balance into v_balance
  from public.money_receivables
  where id=p_receivable_id and user_id=v_user
  for update;
  if v_balance is null then raise exception 'Receivable not found'; end if;
  if v_balance <= 0 then raise exception 'Receivable is already settled'; end if;

  v_effective := least(round(p_amount::numeric,2),v_balance);

  insert into public.money_receivable_transactions(
    user_id,receivable_id,month_id,transaction_type,amount,transaction_date,remarks
  ) values (
    v_user,p_receivable_id,p_month_id,'repayment',v_effective,p_transaction_date,nullif(trim(coalesce(p_remarks,'')),'')
  ) returning id into v_transaction;

  update public.money_receivables
  set current_balance = current_balance - v_effective,
      is_active = (current_balance - v_effective) > 0,
      updated_at = now()
  where id=p_receivable_id and user_id=v_user
  returning current_balance into v_balance;

  return query select v_transaction,v_balance,v_effective;
end;
$$;

create or replace function public.money_reverse_receivable_transaction(
  p_transaction_id uuid,
  p_reason text default 'Correction'
)
returns table(reversal_id uuid, receivable_balance numeric)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_tx public.money_receivable_transactions%rowtype;
  v_balance numeric(14,2);
  v_reversal uuid;
begin
  if v_user is null or not public.money_allowed_user() then raise exception 'Not authorized'; end if;

  select * into v_tx
  from public.money_receivable_transactions
  where id=p_transaction_id and user_id=v_user
  for update;
  if v_tx.id is null then raise exception 'Transaction not found'; end if;
  if v_tx.transaction_type='reversal' then raise exception 'A reversal cannot be reversed'; end if;
  if v_tx.reversed_at is not null then raise exception 'Transaction already reversed'; end if;

  select current_balance into v_balance
  from public.money_receivables
  where id=v_tx.receivable_id and user_id=v_user
  for update;
  if v_balance is null then raise exception 'Receivable not found'; end if;

  if v_tx.transaction_type='repayment' then
    v_balance := v_balance + v_tx.amount;
  elsif v_tx.transaction_type='lend' then
    if v_balance < v_tx.amount then
      raise exception 'Cannot reverse original lend after repayments have reduced the balance';
    end if;
    v_balance := v_balance - v_tx.amount;
  else
    raise exception 'Unsupported transaction type';
  end if;

  update public.money_receivable_transactions
  set reversed_at=now(), remarks=concat_ws(' · ',remarks,'Reversed: '||coalesce(nullif(trim(p_reason),''),'Correction'))
  where id=v_tx.id;

  insert into public.money_receivable_transactions(
    user_id,receivable_id,month_id,transaction_type,amount,transaction_date,remarks,reverses_transaction_id
  ) values (
    v_user,v_tx.receivable_id,v_tx.month_id,'reversal',v_tx.amount,current_date,coalesce(nullif(trim(p_reason),''),'Correction'),v_tx.id
  ) returning id into v_reversal;

  update public.money_receivables
  set current_balance=v_balance,is_active=v_balance>0,updated_at=now()
  where id=v_tx.receivable_id and user_id=v_user;

  return query select v_reversal,v_balance;
end;
$$;

revoke all on function public.money_create_receivable(uuid,text,numeric,date,date,text) from public, anon;
revoke all on function public.money_record_receivable_repayment(uuid,uuid,numeric,date,text) from public, anon;
revoke all on function public.money_reverse_receivable_transaction(uuid,text) from public, anon;
grant execute on function public.money_create_receivable(uuid,text,numeric,date,date,text) to authenticated;
grant execute on function public.money_record_receivable_repayment(uuid,uuid,numeric,date,text) to authenticated;
grant execute on function public.money_reverse_receivable_transaction(uuid,text) to authenticated;
