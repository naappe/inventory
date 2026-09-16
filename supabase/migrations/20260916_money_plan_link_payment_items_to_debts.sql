alter table public.money_items add column if not exists debt_id uuid references public.money_debts(id) on delete set null;
alter table public.money_month_items add column if not exists debt_id uuid references public.money_debts(id) on delete set null;
create index if not exists money_items_debt_idx on public.money_items(debt_id);
create index if not exists money_month_items_debt_idx on public.money_month_items(debt_id);

do $$
declare
  v_user_id uuid;
  v_agro_debt uuid;
  v_council_debt uuid;
begin
  select id into v_user_id from auth.users where lower(email)=lower('naappe@gmail.com') limit 1;
  select id into v_agro_debt from public.money_debts where user_id=v_user_id and lower(name)=lower('Agro Credit') limit 1;
  select id into v_council_debt from public.money_debts where user_id=v_user_id and lower(name)=lower('Council Credit') limit 1;

  update public.money_items set debt_id=v_agro_debt where user_id=v_user_id and lower(name)=lower('Agro');
  update public.money_items set debt_id=v_council_debt where user_id=v_user_id and lower(name)=lower('Council');

  update public.money_month_items mi
  set debt_id = i.debt_id
  from public.money_items i
  where mi.item_id=i.id and mi.user_id=v_user_id and i.debt_id is not null;

  update public.money_debts
  set monthly_plan=1500,
      monthly_plan_history=coalesce(monthly_plan_history,'{}'::jsonb) || jsonb_build_object('2026-09',1500)
  where id in (v_agro_debt, v_council_debt);
end $$;
