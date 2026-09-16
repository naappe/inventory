do $$
declare
  v_user uuid;
  v_home uuid;
  v_other uuid;
  v_month uuid;
  v_phone_item uuid;
begin
  select id into v_user from auth.users where lower(email)=lower('naappe@gmail.com') limit 1;
  if v_user is null then raise exception 'Money Plan user not found'; end if;

  update public.money_categories set name='Credits', behavior_type='liability' where user_id=v_user and name='Credit';
  update public.money_categories set behavior_type='liability' where user_id=v_user and name='Loans';
  update public.money_categories set name='Home Expenses', behavior_type='expense' where user_id=v_user and name='Home';
  update public.money_categories set name='Other Expenses', behavior_type='expense' where user_id=v_user and name='Other';
  update public.money_categories set behavior_type='expense' where user_id=v_user and name in ('Family','Utilities','Food','Personal','Cosmetics','Transport');

  if not exists (select 1 from public.money_categories where user_id=v_user and name='Money Lent') then
    insert into public.money_categories(user_id,name,display_order,behavior_type,is_active)
    select v_user,'Money Lent',coalesce(max(display_order),0)+1,'receivable',true
    from public.money_categories where user_id=v_user;
  else
    update public.money_categories set behavior_type='receivable',is_active=true where user_id=v_user and name='Money Lent';
  end if;

  select id into v_home from public.money_categories where user_id=v_user and name='Home Expenses' limit 1;
  select id into v_other from public.money_categories where user_id=v_user and name='Other Expenses' limit 1;

  update public.money_items set category_id=v_home where user_id=v_user and name in ('Electricity','Kids','Water','Food & Other');
  update public.money_items set name='Food' where user_id=v_user and name='Food & Other';
  update public.money_items set category_id=v_other where user_id=v_user and name in ('Cigarettes Credit','Coffee Credit');
  update public.money_items set is_active=false where user_id=v_user and name in ('Agro','Council');

  select id into v_phone_item from public.money_items where user_id=v_user and lower(name)=lower('Phone bill') limit 1;
  if v_phone_item is null then
    insert into public.money_items(user_id,category_id,name,default_planned_amount,is_recurring,is_active)
    values(v_user,v_home,'Phone bill',0,true,true)
    returning id into v_phone_item;
  else
    update public.money_items set category_id=v_home,is_active=true where id=v_phone_item;
  end if;

  select id into v_month from public.money_months where user_id=v_user and month_key='2026-09' limit 1;
  if v_month is not null then
    delete from public.money_month_items where user_id=v_user and month_id=v_month and name_snapshot in ('Agro','Council');

    update public.money_month_items
      set category_id=v_home, category_snapshot='Home Expenses', name_snapshot=case when name_snapshot='Food & Other' then 'Food' else name_snapshot end
      where user_id=v_user and month_id=v_month and name_snapshot in ('Electricity','Kids','Water','Food & Other');

    update public.money_month_items
      set category_id=v_other, category_snapshot='Other Expenses'
      where user_id=v_user and month_id=v_month and name_snapshot in ('Cigarettes Credit','Coffee Credit');

    if not exists (select 1 from public.money_month_items where user_id=v_user and month_id=v_month and item_id=v_phone_item) then
      insert into public.money_month_items(user_id,month_id,item_id,category_id,name_snapshot,category_snapshot,planned_amount)
      values(v_user,v_month,v_phone_item,v_home,'Phone bill','Home Expenses',0);
    end if;
  end if;

  update public.money_debts set name='Agro',debt_type='loan',monthly_plan=0,monthly_plan_history=coalesce(monthly_plan_history,'{}'::jsonb) || jsonb_build_object('2026-09',0) where user_id=v_user and name='Agro Credit';
  update public.money_debts set name='Council',debt_type='loan',monthly_plan=0,monthly_plan_history=coalesce(monthly_plan_history,'{}'::jsonb) || jsonb_build_object('2026-09',0) where user_id=v_user and name='Council Credit';
  update public.money_debts set name='Naseembe',debt_type='loan',monthly_plan=0,monthly_plan_history=coalesce(monthly_plan_history,'{}'::jsonb) || jsonb_build_object('2026-09',0) where user_id=v_user and name='Naseembe Credit';
  update public.money_debts set name='Alikko',debt_type='loan',monthly_plan=0,monthly_plan_history=coalesce(monthly_plan_history,'{}'::jsonb) || jsonb_build_object('2026-09',0) where user_id=v_user and name='Alikko Cycle Credit';
  update public.money_debts set name='BML',debt_type='loan',monthly_plan=0,monthly_plan_history=coalesce(monthly_plan_history,'{}'::jsonb) || jsonb_build_object('2026-09',0) where user_id=v_user and name='Loan Bank Credit';
end $$;
