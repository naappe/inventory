-- Category-driven Money Plan database checks
-- Expected after migrations: every query returns the expected truth value / zero invalid rows.

-- 1. Category behavior must exist and be constrained to the supported values.
select count(*) as invalid_behavior_rows
from public.money_categories
where behavior_type not in ('liability','expense','receivable');

-- 2. Receivable tables must exist and have RLS enabled.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname='public'
  and c.relname in ('money_receivables','money_receivable_transactions')
order by c.relname;

-- 3. Every receivable table must carry user_id.
select table_name, count(*) filter (where column_name='user_id') as user_id_columns
from information_schema.columns
where table_schema='public'
  and table_name in ('money_receivables','money_receivable_transactions')
group by table_name
order by table_name;

-- 4. Required indexes used by balance and month queries must exist.
select indexname
from pg_indexes
where schemaname='public'
  and tablename in ('money_receivables','money_receivable_transactions')
order by tablename,indexname;
