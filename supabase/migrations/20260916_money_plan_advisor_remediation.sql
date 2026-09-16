-- Advisor remediation applied after the initial Money Plan schema.
-- Use plain text + lower(name) indexes instead of citext in public, index item FK,
-- use invoker RPCs, and cache auth checks per statement in RLS policies.

alter table public.money_categories alter column name type text using name::text;
alter table public.money_items alter column name type text using name::text;
alter table public.money_debts alter column name type text using name::text;

alter table public.money_categories drop constraint if exists money_categories_user_id_name_key;
alter table public.money_items drop constraint if exists money_items_user_id_name_key;
create unique index if not exists money_categories_unique_name_ci on public.money_categories(user_id, lower(name));
create unique index if not exists money_items_unique_name_ci on public.money_items(user_id, lower(name));
create index if not exists money_month_items_item_idx on public.money_month_items(item_id);

drop extension if exists citext;

alter function public.money_create_month(text) security invoker;
alter function public.money_bootstrap_september() security invoker;
alter function public.money_record_payment(uuid,text,numeric,date,uuid,uuid,text) security invoker;
alter function public.money_reverse_payment(uuid,text) security invoker;

do $$
declare t text;
begin
  foreach t in array array['money_categories','money_items','money_months','money_month_items','money_debts','money_payments'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select using ((select public.money_allowed_user()) and user_id = (select auth.uid()))', t || '_select', t);
    execute format('create policy %I on public.%I for insert with check ((select public.money_allowed_user()) and user_id = (select auth.uid()))', t || '_insert', t);
    execute format('create policy %I on public.%I for update using ((select public.money_allowed_user()) and user_id = (select auth.uid())) with check ((select public.money_allowed_user()) and user_id = (select auth.uid()))', t || '_update', t);
    execute format('create policy %I on public.%I for delete using ((select public.money_allowed_user()) and user_id = (select auth.uid()))', t || '_delete', t);
  end loop;
end $$;
