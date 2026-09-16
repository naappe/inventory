do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id
  from auth.users
  where lower(email)=lower('naappe@gmail.com')
  limit 1;

  if v_user_id is null then
    raise exception 'Allowed Money Plan user not found';
  end if;

  insert into public.money_debts
    (user_id, name, debt_type, opening_balance, current_balance, monthly_plan, apr, is_active, start_month_key, monthly_plan_history)
  select v_user_id, x.name, x.debt_type, x.balance, x.balance, x.monthly_plan, null, true, '2026-09', jsonb_build_object('2026-09', x.monthly_plan)
  from (values
    ('Council Credit'::text, 'loan'::text, 25500.00::numeric, 1500.00::numeric),
    ('Agro Credit', 'loan', 9000.00, 1000.00),
    ('Loan Bank Credit', 'loan', 35500.00, 1500.00),
    ('Naseembe Credit', 'loan', 20000.00, 0.00),
    ('Alikko Cycle Credit', 'loan', 15000.00, 0.00)
  ) as x(name, debt_type, balance, monthly_plan)
  where not exists (
    select 1 from public.money_debts d
    where d.user_id = v_user_id
      and lower(d.name) = lower(x.name)
      and d.is_active
  );
end $$;
