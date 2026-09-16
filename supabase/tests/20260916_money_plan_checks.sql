-- Money Plan schema verification checks
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'money_categories','money_items','money_months',
    'money_month_items','money_debts','money_payments'
  )
order by table_name;

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename like 'money_%'
order by tablename;

select proname
from pg_proc
where proname in (
  'money_bootstrap_september',
  'money_create_month',
  'money_record_payment',
  'money_reverse_payment'
)
order by proname;
