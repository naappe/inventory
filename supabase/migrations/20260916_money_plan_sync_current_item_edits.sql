create or replace function public.money_sync_item_updates_to_current_future_months()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_category_name text;
  v_current_month text := to_char(current_date, 'YYYY-MM');
begin
  select name into v_category_name from public.money_categories where id = new.category_id;
  v_category_name := coalesce(v_category_name, 'Other');

  update public.money_month_items mi
  set category_id = new.category_id,
      name_snapshot = new.name,
      category_snapshot = v_category_name,
      planned_amount = new.default_planned_amount,
      due_date = case
        when new.due_day is null then null
        else make_date(
          split_part(m.month_key, '-', 1)::int,
          split_part(m.month_key, '-', 2)::int,
          least(
            new.due_day,
            extract(day from (date_trunc('month', to_date(m.month_key || '-01','YYYY-MM-DD')) + interval '1 month - 1 day'))::int
          )
        )
      end,
      updated_at = now()
  from public.money_months m
  where m.id = mi.month_id
    and mi.item_id = new.id
    and mi.user_id = new.user_id
    and m.user_id = new.user_id
    and m.month_key >= v_current_month;

  return new;
end;
$$;

drop trigger if exists money_items_sync_current_future on public.money_items;
create trigger money_items_sync_current_future
after update of name, category_id, default_planned_amount, due_day
on public.money_items
for each row
execute function public.money_sync_item_updates_to_current_future_months();
