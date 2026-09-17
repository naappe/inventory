select column_name
from information_schema.columns
where table_schema='public' and table_name='money_months'
  and column_name in ('saved_at','saved_revision','saved_snapshot','dirty_since_save')
order by column_name;

select table_name
from information_schema.tables
where table_schema='public' and table_name='money_preferences';

select proname
from pg_proc
where proname in ('money_save_month','money_mark_month_dirty')
order by proname;
