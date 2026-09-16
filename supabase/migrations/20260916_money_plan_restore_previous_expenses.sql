do $$
declare
  v_user_id uuid;
  v_month_id uuid;
  v_item_id uuid;
  v_category_id uuid;
  r record;
begin
  select id into v_user_id from auth.users where lower(email)=lower('naappe@gmail.com') limit 1;
  if v_user_id is null then raise exception 'Money Plan user not found'; end if;

  select id into v_month_id from public.money_months where user_id=v_user_id and month_key='2026-09' limit 1;
  if v_month_id is null then raise exception 'September 2026 month not found'; end if;

  for r in
    select * from (values
      ('Kids'::text,'Family'::text,5000.00::numeric),
      ('Cigarettes Credit','Credit',5000.00),
      ('Coffee Credit','Credit',2500.00),
      ('Electricity','Utilities',1000.00),
      ('Water','Utilities',1000.00),
      ('Council','Loans',1500.00),
      ('Agro','Loans',1500.00),
      ('Food & Other','Food',5000.00)
    ) as v(name,category_name,planned_amount)
  loop
    select id into v_category_id from public.money_categories
      where user_id=v_user_id and lower(name)=lower(r.category_name) limit 1;

    select id into v_item_id from public.money_items
      where user_id=v_user_id and lower(name)=lower(r.name) limit 1;

    if v_item_id is null then
      insert into public.money_items(user_id,category_id,name,default_planned_amount,is_recurring,is_active)
      values(v_user_id,v_category_id,r.name,r.planned_amount,true,true)
      returning id into v_item_id;
    else
      update public.money_items
      set category_id=v_category_id,
          default_planned_amount=r.planned_amount,
          is_recurring=true,
          is_active=true,
          updated_at=now()
      where id=v_item_id;
    end if;

    if exists(select 1 from public.money_month_items where month_id=v_month_id and item_id=v_item_id) then
      update public.money_month_items
      set category_id=v_category_id,
          name_snapshot=r.name,
          category_snapshot=r.category_name,
          planned_amount=r.planned_amount,
          updated_at=now()
      where month_id=v_month_id and item_id=v_item_id;
    else
      insert into public.money_month_items(user_id,month_id,item_id,category_id,name_snapshot,category_snapshot,planned_amount)
      values(v_user_id,v_month_id,v_item_id,v_category_id,r.name,r.category_name,r.planned_amount);
    end if;
  end loop;
end $$;
