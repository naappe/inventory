# Month Save, Debt Priority, and Savings Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a non-locking monthly save workflow, persistent saved snapshots, dirty-after-edit behavior, smart debt prioritization, and safe-to-save guidance to My Money Plan.

**Architecture:** Persist month-save metadata on `money_months`, persist the emergency reserve in a single-user preference row, and keep recommendation logic in pure JavaScript models. All finance mutations mark the affected saved month dirty; Overview renders live values plus saved-state/guidance, while History reads the last confirmed snapshot when one exists.

**Tech Stack:** Static HTML/CSS/ES modules, Supabase Postgres + RPC/RLS, Node.js 22 built-in test runner, GitHub Pages/PWA service worker.

**Spec:** `docs/superpowers/specs/2026-09-17-month-save-debt-savings-design.md`

## Global Constraints

- Saving a month does not lock editing.
- After a saved month changes, status becomes `Changes not saved` until the user saves again.
- Debt priority uses highest APR when meaningful APR exists; otherwise smallest remaining balance.
- Advice is informational only; it must never create payments or transfers.
- Emergency reserve defaults to MVR 0.00 and is user-editable.
- Safe-to-save and suggested-extra-payment values must never be negative.
- Saved History must show the last confirmed snapshot even when the current month later becomes dirty.
- Existing Supabase RLS and single-user authorization must remain intact.
- No browser `localStorage` is introduced.
- Existing Money Plan verification must remain green: `node --test tests/*.test.mjs` and `node --check` for all JS files.

---

## File Structure

New focused files:

- `supabase/migrations/20260917_month_save_debt_guidance.sql` — month save fields, preference table, save/dirty RPCs.
- `supabase/tests/20260917_month_save_debt_guidance_checks.sql` — schema/RPC verification queries.
- `js/month-save-model.js` — saved-state labels, snapshot creation, saved-vs-live comparison.
- `js/debt-guidance-model.js` — smart-hybrid debt priority and savings/extra-payment guidance.
- `tests/month-save-model.test.mjs` — pure save-state/snapshot tests.
- `tests/debt-guidance-model.test.mjs` — pure debt/savings guidance tests.

Existing files to modify:

- `js/money-api.js` — save month, dirty marking, preference reads/writes.
- `js/money-app.js` — Save Month action, dirty marking on finance mutations, History model integration.
- `js/screens/overview.js` — month completion card and Debt & Savings Plan panel.
- `js/screens/settings.js` — emergency reserve editor.
- `js/screens/history.js` — saved status and snapshot detail rendering.
- `js/debt-total-editor.js`, `js/debt-delete-actions.js`, `js/receivable-edit-actions.js`, `js/undo-payment-actions.js` — dirty marking for mutations that bypass `money-app.js`.
- `money-plan-v2.css` — completion/guidance/reserve/snapshot UI.
- `index.html`, `sw.js`, `.github/workflows/money-plan-verify.yml` — load/cache/version and verification updates.

---

### Task 1: Persist Month Save State and Emergency Reserve

**Files:**
- Create: `supabase/migrations/20260917_month_save_debt_guidance.sql`
- Create: `supabase/tests/20260917_month_save_debt_guidance_checks.sql`
- Modify: `.github/workflows/money-plan-verify.yml`

**Interfaces:**
- Produces RPC `money_save_month(p_month_id uuid, p_snapshot jsonb)` returning the updated `money_months` row.
- Produces RPC `money_mark_month_dirty(p_month_id uuid)` returning boolean.
- Produces table `money_preferences(user_id uuid primary key, emergency_reserve_target numeric(14,2) not null default 0, updated_at timestamptz)`.

- [ ] **Step 1: Add SQL verification first**

Create `supabase/tests/20260917_month_save_debt_guidance_checks.sql`:

```sql
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
```

- [ ] **Step 2: Create the migration**

Use this schema shape in `supabase/migrations/20260917_month_save_debt_guidance.sql`:

```sql
alter table public.money_months
  add column if not exists saved_at timestamptz,
  add column if not exists saved_revision integer not null default 0,
  add column if not exists saved_snapshot jsonb,
  add column if not exists dirty_since_save boolean not null default false;

create table if not exists public.money_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  emergency_reserve_target numeric(14,2) not null default 0 check (emergency_reserve_target >= 0),
  updated_at timestamptz not null default now()
);

alter table public.money_preferences enable row level security;

drop policy if exists money_preferences_select on public.money_preferences;
drop policy if exists money_preferences_insert on public.money_preferences;
drop policy if exists money_preferences_update on public.money_preferences;
create policy money_preferences_select on public.money_preferences
  for select using (public.money_allowed_user() and user_id=auth.uid());
create policy money_preferences_insert on public.money_preferences
  for insert with check (public.money_allowed_user() and user_id=auth.uid());
create policy money_preferences_update on public.money_preferences
  for update using (public.money_allowed_user() and user_id=auth.uid())
  with check (public.money_allowed_user() and user_id=auth.uid());

create or replace function public.money_save_month(p_month_id uuid, p_snapshot jsonb)
returns public.money_months
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_uid uuid:=auth.uid(); v_row public.money_months%rowtype;
begin
  if not public.money_allowed_user() then raise exception 'Not authorized'; end if;
  update public.money_months
  set saved_at=now(),
      saved_revision=saved_revision+1,
      saved_snapshot=coalesce(p_snapshot,'{}'::jsonb),
      dirty_since_save=false
  where id=p_month_id and user_id=v_uid
  returning * into v_row;
  if not found then raise exception 'Invalid month'; end if;
  return v_row;
end;
$$;

create or replace function public.money_mark_month_dirty(p_month_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_uid uuid:=auth.uid(); v_changed boolean:=false;
begin
  if not public.money_allowed_user() then raise exception 'Not authorized'; end if;
  update public.money_months
  set dirty_since_save=true
  where id=p_month_id and user_id=v_uid and saved_at is not null and dirty_since_save=false;
  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;
```

Use an integer variable for `row_count` if Postgres rejects assigning it directly to boolean; return `v_count > 0`.

- [ ] **Step 3: Add permissions and updated-at behavior**

Add:

```sql
revoke all on function public.money_save_month(uuid,jsonb) from public, anon;
revoke all on function public.money_mark_month_dirty(uuid) from public, anon;
grant execute on function public.money_save_month(uuid,jsonb) to authenticated;
grant execute on function public.money_mark_month_dirty(uuid) to authenticated;

create trigger money_preferences_updated_at
before update on public.money_preferences
for each row execute function public.money_set_updated_at();
```

Wrap trigger creation in the repository's existing idempotent `do $$ ... if not exists ... $$` pattern.

- [ ] **Step 4: Extend CI static verification**

Add to `.github/workflows/money-plan-verify.yml`:

```bash
grep -q 'saved_snapshot' supabase/migrations/20260917_month_save_debt_guidance.sql
grep -q 'money_save_month' supabase/migrations/20260917_month_save_debt_guidance.sql
grep -q 'emergency_reserve_target' supabase/migrations/20260917_month_save_debt_guidance.sql
```

- [ ] **Step 5: Run repository verification**

Run:

```bash
node --test tests/*.test.mjs
find js -name '*.js' -print0 | while IFS= read -r -d '' file; do node --check "$file"; done
```

Expected: existing tests remain PASS; new SQL files are syntactically reviewable and CI grep requirements are present.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260917_month_save_debt_guidance.sql supabase/tests/20260917_month_save_debt_guidance_checks.sql .github/workflows/money-plan-verify.yml
git commit -m "feat: add month save persistence"
```

---

### Task 2: Build Pure Month Save and Debt Guidance Models

**Files:**
- Create: `js/month-save-model.js`
- Create: `js/debt-guidance-model.js`
- Create: `tests/month-save-model.test.mjs`
- Create: `tests/debt-guidance-model.test.mjs`

**Interfaces:**
- Produces `buildMonthSnapshot({ month, dashboard, summary, debtReduced, safeToSave })`.
- Produces `buildMonthSaveState(month)` returning `{ status, label, buttonLabel, savedAt, revision, isDirty }`.
- Produces `buildDebtGuidance({ debts, availableNow, stillToPay, emergencyReserve })`.

- [ ] **Step 1: Write failing month-save tests**

Create `tests/month-save-model.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMonthSaveState, buildMonthSnapshot } from '../js/month-save-model.js';

test('unsaved month is Not Saved', () => {
  assert.equal(buildMonthSaveState({ month_key:'2026-09' }).status, 'not-saved');
});

test('dirty saved month asks to save again', () => {
  const state = buildMonthSaveState({ month_key:'2026-09', saved_at:'2026-09-17T10:00:00Z', saved_revision:1, dirty_since_save:true });
  assert.equal(state.status, 'dirty');
  assert.equal(state.buttonLabel, 'Save September Again');
});

test('snapshot captures confirmed totals', () => {
  const snapshot = buildMonthSnapshot({
    month:{ month_key:'2026-09', bank_balance:8500, income:25000 },
    dashboard:{ totalMoneyThisMonth:33500, paidThisMonth:7400, availableNow:26100, stillLeftToPay:2000, expectedAfterBills:24100, loansLeft:60000, creditsLeft:7285, moneyOwedToMe:0 },
    debtReduced:2500,
    safeToSave:4000,
    savedAt:'2026-09-17T10:00:00Z',
  });
  assert.equal(snapshot.totalMoneyThisMonth, 33500);
  assert.equal(snapshot.debtReduced, 2500);
  assert.equal(snapshot.safeToSave, 4000);
});
```

- [ ] **Step 2: Run month-save tests and verify failure**

Run:

```bash
node --test tests/month-save-model.test.mjs
```

Expected: FAIL because `js/month-save-model.js` does not exist.

- [ ] **Step 3: Implement `js/month-save-model.js`**

Core shape:

```js
const round2 = (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;
const monthName = (key) => new Date(`${key}-01T00:00:00`).toLocaleDateString('en-US',{month:'long'});

export function buildMonthSaveState(month = {}) {
  const saved = Boolean(month.saved_at);
  const dirty = saved && Boolean(month.dirty_since_save);
  const name = monthName(month.month_key || '2026-09');
  return {
    status: !saved ? 'not-saved' : dirty ? 'dirty' : 'saved',
    label: !saved ? 'Not Saved' : dirty ? 'Changes not saved' : 'Saved',
    buttonLabel: !saved ? `Save ${name}` : dirty ? `Save ${name} Again` : null,
    savedAt: month.saved_at || null,
    revision: Number(month.saved_revision || 0),
    isDirty: dirty,
  };
}

export function buildMonthSnapshot({ month = {}, dashboard = {}, debtReduced = 0, safeToSave = 0, savedAt = new Date().toISOString() } = {}) {
  return {
    monthKey: month.month_key,
    openingBankBalance: round2(dashboard.openingBankBalance),
    salaryReceived: round2(dashboard.salaryReceived),
    totalMoneyThisMonth: round2(dashboard.totalMoneyThisMonth),
    spentThisMonth: round2(dashboard.paidThisMonth),
    stillToPay: round2(dashboard.stillLeftToPay),
    availableNow: round2(dashboard.availableNow),
    expectedMonthEnd: round2(dashboard.expectedAfterBills),
    loansRemaining: round2(dashboard.loansLeft),
    creditsRemaining: round2(dashboard.creditsLeft),
    moneyOwedToMe: round2(dashboard.moneyOwedToMe),
    safeToSave: round2(safeToSave),
    debtReduced: round2(debtReduced),
    savedAt,
  };
}
```

- [ ] **Step 4: Write failing debt-guidance tests**

Create `tests/debt-guidance-model.test.mjs` with these cases:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDebtGuidance } from '../js/debt-guidance-model.js';

test('highest APR wins when APR exists', () => {
  const result = buildDebtGuidance({ debts:[
    {id:'a',name:'A',debt_type:'loan',current_balance:9000,monthly_plan:1000,apr:8},
    {id:'b',name:'B',debt_type:'credit',current_balance:12000,monthly_plan:1500,apr:18},
  ], availableNow:10000, stillToPay:3000, emergencyReserve:2000 });
  assert.equal(result.focusDebt.id, 'b');
});

test('smaller balance breaks APR tie', () => {
  const result = buildDebtGuidance({ debts:[
    {id:'a',name:'A',current_balance:5000,apr:12},
    {id:'b',name:'B',current_balance:3000,apr:12},
  ]});
  assert.equal(result.focusDebt.id, 'b');
});

test('smallest balance wins when APR is absent', () => {
  const result = buildDebtGuidance({ debts:[
    {id:'a',name:'A',current_balance:9000,apr:null},
    {id:'b',name:'B',current_balance:4000,apr:null},
  ]});
  assert.equal(result.focusDebt.id, 'b');
});

test('safe to save and extra payment never go negative', () => {
  const result = buildDebtGuidance({ debts:[{id:'a',name:'A',current_balance:9000}], availableNow:1000, stillToPay:2000, emergencyReserve:1000 });
  assert.equal(result.safeToSave, 0);
  assert.equal(result.suggestedExtraPayment, 0);
});

test('extra payment never exceeds focus balance', () => {
  const result = buildDebtGuidance({ debts:[{id:'a',name:'A',current_balance:1500}], availableNow:10000, stillToPay:1000, emergencyReserve:1000 });
  assert.equal(result.suggestedExtraPayment, 1500);
});

test('no active debt returns an empty guidance state', () => {
  const result = buildDebtGuidance({ debts:[] });
  assert.equal(result.focusDebt, null);
});
```

- [ ] **Step 5: Implement `js/debt-guidance-model.js`**

```js
const round2 = (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;

export function buildDebtGuidance({ debts = [], availableNow = 0, stillToPay = 0, emergencyReserve = 0 } = {}) {
  const open = debts.filter((d) => Number(d.current_balance || 0) > 0 && d.is_active !== false);
  const withApr = open.filter((d) => Number(d.apr || 0) > 0);
  const ranked = [...open].sort((a,b) => {
    if (withApr.length) return Number(b.apr || 0) - Number(a.apr || 0) || Number(a.current_balance || 0) - Number(b.current_balance || 0);
    return Number(a.current_balance || 0) - Number(b.current_balance || 0) || String(a.name || '').localeCompare(String(b.name || ''));
  });
  const focusDebt = ranked[0] || null;
  const nextDebt = ranked[1] || null;
  const afterPlans = Math.max(0, round2(Number(availableNow || 0) - Number(stillToPay || 0)));
  const discretionary = Math.max(0, round2(afterPlans - Number(emergencyReserve || 0)));
  const suggestedExtraPayment = focusDebt ? Math.min(round2(focusDebt.current_balance), discretionary) : 0;
  const safeToSave = discretionary;
  const projectedFocusBalance = focusDebt ? Math.max(0, round2(Number(focusDebt.current_balance || 0) - suggestedExtraPayment)) : 0;
  const reason = !focusDebt ? 'No active loan or credit remains.'
    : withApr.length ? `Highest APR at ${Number(focusDebt.apr).toFixed(2)}%, so extra payment here reduces interest cost first.`
    : 'No APR entered, so the smallest remaining balance is the quickest account to clear.';
  return { focusDebt, nextDebt, reason, safeToSave, suggestedExtraPayment, projectedFocusBalance, emergencyReserve:round2(emergencyReserve), cashFreedAfterPayoff:round2(focusDebt?.monthly_plan || 0) };
}
```

- [ ] **Step 6: Run both model test files**

```bash
node --test tests/month-save-model.test.mjs tests/debt-guidance-model.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add js/month-save-model.js js/debt-guidance-model.js tests/month-save-model.test.mjs tests/debt-guidance-model.test.mjs
git commit -m "feat: add month save and debt guidance models"
```

---

### Task 3: Add Save/Dirty/Preference API Methods

**Files:**
- Modify: `js/money-api.js`
- Test: `tests/money-api-contract.test.mjs`

**Interfaces:**
- Produces `saveMonth(monthId, snapshot)`.
- Produces `markMonthDirty(monthId)`.
- Produces `getMoneyPreferences()`.
- Produces `setEmergencyReserveTarget(amount)`.

- [ ] **Step 1: Add contract tests for exported API source**

Create `tests/money-api-contract.test.mjs` that reads `js/money-api.js` and asserts these export names are present. Use Node `fs.readFileSync` so no Supabase network is required:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../js/money-api.js', import.meta.url), 'utf8');
for (const name of ['saveMonth','markMonthDirty','getMoneyPreferences','setEmergencyReserveTarget']) {
  test(`exports ${name}`, () => assert.match(src, new RegExp(`export async function ${name}\\b`)));
}
```

- [ ] **Step 2: Run contract test and verify failure**

```bash
node --test tests/money-api-contract.test.mjs
```

Expected: FAIL for missing exports.

- [ ] **Step 3: Add API implementations**

In `js/money-api.js` add:

```js
export async function saveMonth(monthId, snapshot) {
  await requireUser();
  const { data, error } = await supabase.rpc('money_save_month', { p_month_id: monthId, p_snapshot: snapshot });
  if (error) throw error;
  return data;
}

export async function markMonthDirty(monthId) {
  await requireUser();
  if (!monthId) return false;
  const { data, error } = await supabase.rpc('money_mark_month_dirty', { p_month_id: monthId });
  if (error) throw error;
  return Boolean(data);
}

export async function getMoneyPreferences() {
  const user = await requireUser();
  const { data, error } = await supabase.from('money_preferences').select('*').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  return data || { user_id:user.id, emergency_reserve_target:0 };
}

export async function setEmergencyReserveTarget(amount) {
  const user = await requireUser();
  const value = nonNegative(amount);
  const { data, error } = await supabase.from('money_preferences')
    .upsert({ user_id:user.id, emergency_reserve_target:value }, { onConflict:'user_id' })
    .select().single();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 4: Include preferences in `getMonthBundle`**

Change its `Promise.all` to load `getMoneyPreferences()` and return `preferences` in the bundle. This allows Overview/Settings to remain pure renderers.

- [ ] **Step 5: Run tests and syntax checks**

```bash
node --test tests/money-api-contract.test.mjs tests/*.test.mjs
node --check js/money-api.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add js/money-api.js tests/money-api-contract.test.mjs
git commit -m "feat: expose month save and preference APIs"
```

---

### Task 4: Wire Save Month and Dirty Marking into Main Mutations

**Files:**
- Modify: `js/money-app.js`
- Modify: `tests/money-ui-models.test.mjs` or create `tests/month-save-ui-contract.test.mjs`

**Interfaces:**
- Consumes `buildMonthSnapshot`, `buildDebtGuidance`, `api.saveMonth`, `api.markMonthDirty`.
- Produces UI action `data-action="save-month"` handled by `money-app.js`.

- [ ] **Step 1: Add a source contract test for Save Month action**

Create `tests/month-save-ui-contract.test.mjs` checking that `money-app.js` imports `buildMonthSnapshot` and contains `action==='save-month'` plus `api.saveMonth`.

- [ ] **Step 2: Run the contract test and verify failure**

```bash
node --test tests/month-save-ui-contract.test.mjs
```

- [ ] **Step 3: Add a helper that marks the selected month dirty only after successful mutations**

In `money-app.js`:

```js
async function markCurrentMonthDirty() {
  if (state.bundle?.month?.saved_at) await api.markMonthDirty(state.bundle.month.id);
}
```

For every finance mutation callback in this file, call `await markCurrentMonthDirty()` after the mutation succeeds and before `reload(...)`: salary, opening bank, add/edit expense, add/edit debt, add receivable, repayment, expense/debt payment, expense delete, payment reversal, receivable reversal.

Do not mark dirty for navigation, sign-out, setup completion, or category-only edits unless the category edit changes current month amounts.

- [ ] **Step 4: Add `saveCurrentMonth()`**

Use current live calculations, not stale saved data:

```js
async function saveCurrentMonth() {
  const summary = calculateMonthSummary({
    income:state.bundle.month.income,
    monthItems:state.bundle.monthItems,
    payments:state.bundle.payments,
    debts:state.bundle.debts,
    receivables:state.bundle.receivables,
    receivableTransactions:state.bundle.receivableTransactions,
  });
  const dashboard = buildDashboardModel({ month:state.bundle.month, summary });
  const guidance = buildDebtGuidance({
    debts:state.bundle.debts,
    availableNow:dashboard.availableNow,
    stillToPay:dashboard.stillLeftToPay,
    emergencyReserve:state.bundle.preferences?.emergency_reserve_target || 0,
  });
  const debtPaid = state.bundle.payments.filter((p)=>!p.reversed_at && p.payment_type==='debt').reduce((s,p)=>s+Number(p.amount||0),0);
  const snapshot = buildMonthSnapshot({ month:state.bundle.month, dashboard, debtReduced:debtPaid, safeToSave:guidance.safeToSave });
  await api.saveMonth(state.bundle.month.id, snapshot);
  await reload(`${monthLabel(state.monthKey)} saved`);
}
```

Import `buildDashboardModel`, `buildMonthSnapshot`, and `buildDebtGuidance` at the top.

- [ ] **Step 5: Handle the Save Month action**

In `handleAction`:

```js
if(action==='save-month') return saveCurrentMonth();
```

- [ ] **Step 6: Expose current month id/key to auxiliary modules**

In `renderChrome()` set:

```js
app.dataset.monthId = state.bundle?.month?.id || '';
app.dataset.monthKey = state.monthKey;
```

This lets editor modules that bypass `money-app.js` mark the selected saved month dirty without parsing the page title.

- [ ] **Step 7: Run tests**

```bash
node --test tests/month-save-ui-contract.test.mjs tests/*.test.mjs
node --check js/money-app.js
```

- [ ] **Step 8: Commit**

```bash
git add js/money-app.js tests/month-save-ui-contract.test.mjs
git commit -m "feat: wire month save workflow"
```

---

### Task 5: Mark Auxiliary Edit/Delete/Undo Flows Dirty

**Files:**
- Modify: `js/debt-total-editor.js`
- Modify: `js/debt-delete-actions.js`
- Modify: `js/receivable-edit-actions.js`
- Modify: `js/undo-payment-actions.js`
- Test: `tests/month-dirty-auxiliary-contract.test.mjs`

**Interfaces:**
- Consumes `markMonthDirty(monthId)` from `money-api.js`.
- Reads selected month id from `#app.dataset.monthId`.

- [ ] **Step 1: Write contract tests**

Create a test that reads all four files and verifies they import/use `markMonthDirty` after successful mutations.

- [ ] **Step 2: Run it and verify failure**

```bash
node --test tests/month-dirty-auxiliary-contract.test.mjs
```

- [ ] **Step 3: Add a shared local helper in each module**

Use:

```js
import { markMonthDirty } from './money-api.js';
const currentMonthId = () => document.getElementById('app')?.dataset.monthId || null;
async function dirtyCurrentMonth(){ const id=currentMonthId(); if(id) await markMonthDirty(id); }
```

- [ ] **Step 4: Mark dirty after each successful mutation**

Apply after:

- `money_edit_debt_month` succeeds in `debt-total-editor.js`.
- debt/payment deletion succeeds in `debt-delete-actions.js`.
- receivable edit/delete succeeds in `receivable-edit-actions.js`.
- row payment reversal succeeds in `undo-payment-actions.js`.

Do not mark dirty before the database operation; otherwise a failed edit would incorrectly show `Changes not saved`.

- [ ] **Step 5: Run tests and syntax checks**

```bash
node --test tests/month-dirty-auxiliary-contract.test.mjs tests/*.test.mjs
node --check js/debt-total-editor.js
node --check js/debt-delete-actions.js
node --check js/receivable-edit-actions.js
node --check js/undo-payment-actions.js
```

- [ ] **Step 6: Commit**

```bash
git add js/debt-total-editor.js js/debt-delete-actions.js js/receivable-edit-actions.js js/undo-payment-actions.js tests/month-dirty-auxiliary-contract.test.mjs
git commit -m "fix: mark saved month dirty after auxiliary edits"
```

---

### Task 6: Add Overview Month Status and Debt & Savings Plan

**Files:**
- Modify: `js/screens/overview.js`
- Modify: `money-plan-v2.css`
- Test: `tests/overview-guidance-contract.test.mjs`

**Interfaces:**
- Consumes `buildMonthSaveState(month)`.
- Consumes `buildDebtGuidance({ debts, availableNow, stillToPay, emergencyReserve })`.
- Emits `data-action="save-month"` and `data-view="settings"` controls.

- [ ] **Step 1: Add renderer source contract tests**

Check that `overview.js` imports both models and contains `save-month`, `Debt & Savings Plan`, `Changes not saved`, and `Emergency reserve` strings.

- [ ] **Step 2: Run test and verify failure**

```bash
node --test tests/overview-guidance-contract.test.mjs
```

- [ ] **Step 3: Build live state at the top of `renderOverview`**

After `model`:

```js
const saveState = buildMonthSaveState(month);
const guidance = buildDebtGuidance({
  debts,
  availableNow:model.availableNow,
  stillToPay:model.stillLeftToPay,
  emergencyReserve:bundle.preferences?.emergency_reserve_target || 0,
});
```

- [ ] **Step 4: Render the month completion card above the KPI grid**

The card must show:

- `Not Saved`, `Saved`, or `Changes not saved`.
- saved time when available.
- `Save September` or `Save September Again` button when applicable.
- for dirty months, a `<details>` comparison with at least saved vs current `spentThisMonth`, `availableNow`, `stillToPay`, and `expectedMonthEnd`.

Use the last confirmed `month.saved_snapshot`; never overwrite it client-side.

- [ ] **Step 5: Render Debt & Savings Plan below the main cash summary**

Show these exact concepts:

```text
Focus debt
Why this debt
Suggested extra payment
Balance after suggested extra
Cash freed after payoff
Next debt
Safe to save
Emergency reserve
```

If `guidance.focusDebt` is null, show `No active loan or credit remains.` and still show `Safe to save` plus reserve.

If `guidance.suggestedExtraPayment === 0`, display `No extra payment suggested yet` rather than `MVR 0.00 extra`.

Add `Settings` link/button near Emergency reserve so the user can change it.

- [ ] **Step 6: Add responsive CSS**

Add classes such as `.month-save-card`, `.month-status`, `.month-status.is-dirty`, `.snapshot-compare`, `.debt-guidance-panel`, `.guidance-grid`, `.focus-debt-card`. Match existing rounded panel spacing and collapse to one column below 760px.

- [ ] **Step 7: Run tests and syntax checks**

```bash
node --test tests/overview-guidance-contract.test.mjs tests/*.test.mjs
node --check js/screens/overview.js
```

- [ ] **Step 8: Commit**

```bash
git add js/screens/overview.js money-plan-v2.css tests/overview-guidance-contract.test.mjs
git commit -m "feat: show month save status and debt guidance"
```

---

### Task 7: Add Emergency Reserve Setting

**Files:**
- Modify: `js/screens/settings.js`
- Modify: `js/money-app.js`
- Test: `tests/settings-reserve-contract.test.mjs`

**Interfaces:**
- `renderSettings({ user, categories, items, preferences })`.
- UI action `data-action="set-emergency-reserve"`.
- Consumes `api.setEmergencyReserveTarget(amount)`.

- [ ] **Step 1: Write failing settings contract test**

Verify `settings.js` contains `Emergency reserve` and `set-emergency-reserve`; verify `money-app.js` contains the matching action handler.

- [ ] **Step 2: Update Settings renderer**

Change the signature to accept `preferences = {}` and add a panel:

```html
<article class="panel">
  <div class="panel-head">
    <div><h2>Emergency reserve</h2><p>Keep this amount untouched before the app suggests extra debt payments or savings.</p></div>
    <button class="button secondary compact" data-action="set-emergency-reserve">Edit</button>
  </div>
  <strong>MVR ...</strong>
</article>
```

- [ ] **Step 3: Pass preferences from `money-app.js`**

Change Settings render call to:

```js
renderSettings({ user:state.user, categories:state.bundle.categories, items:state.items, preferences:state.bundle.preferences })
```

- [ ] **Step 4: Add the edit sheet**

Add:

```js
function openEmergencyReserveSheet(){
  openSheet({
    title:'Emergency reserve',
    subtitle:'Money to keep untouched before extra debt payments or savings.',
    body:field.money('amount','Reserve target',state.bundle.preferences?.emergency_reserve_target || 0,'required min="0"'),
    submitLabel:'Save reserve',
    onSubmit:async(v)=>{ await api.setEmergencyReserveTarget(v.amount); await reload('Emergency reserve updated'); }
  });
}
```

The reserve preference itself is not a historical finance mutation, so it does not need to mark the current saved month dirty; saved snapshots keep the safe-to-save value that existed when saved.

- [ ] **Step 5: Wire action and run tests**

```js
if(action==='set-emergency-reserve') return openEmergencyReserveSheet();
```

Run:

```bash
node --test tests/settings-reserve-contract.test.mjs tests/*.test.mjs
node --check js/screens/settings.js
node --check js/money-app.js
```

- [ ] **Step 6: Commit**

```bash
git add js/screens/settings.js js/money-app.js tests/settings-reserve-contract.test.mjs
git commit -m "feat: add emergency reserve preference"
```

---

### Task 8: Make History Use Saved Snapshots

**Files:**
- Modify: `js/money-app.js`
- Modify: `js/screens/history.js`
- Create: `tests/history-snapshot-model.test.mjs`

**Interfaces:**
- History row gains `saveStatus`, `savedAt`, `snapshot`, and `isDirty`.
- Saved rows use `month.saved_snapshot` for displayed confirmed totals.

- [ ] **Step 1: Add a small pure helper in `month-save-model.js`**

Add:

```js
export function historyValuesForMonth({ month = {}, live = {} } = {}) {
  const snapshot = month.saved_snapshot && typeof month.saved_snapshot === 'object' ? month.saved_snapshot : null;
  if (!snapshot) return { ...live, source:'live' };
  return {
    income:Number(snapshot.salaryReceived || 0),
    paid:Number(snapshot.spentThisMonth || 0),
    stillToPay:Number(snapshot.stillToPay || 0),
    safeToSave:Number(snapshot.safeToSave || 0),
    availableNow:Number(snapshot.availableNow || 0),
    debtReduced:Number(snapshot.debtReduced || 0),
    loansRemaining:Number(snapshot.loansRemaining || 0),
    creditsRemaining:Number(snapshot.creditsRemaining || 0),
    source:'saved',
  };
}
```

- [ ] **Step 2: Write failing tests**

`tests/history-snapshot-model.test.mjs` must prove:

- unsaved month returns live values;
- saved month returns snapshot values;
- dirty saved month still returns the old snapshot, not unsaved live edits.

- [ ] **Step 3: Run test and verify failure, then implement helper**

```bash
node --test tests/history-snapshot-model.test.mjs
```

- [ ] **Step 4: Update `buildHistoryModel()`**

After live summary calculation, build `liveValues`, call `historyValuesForMonth`, and populate each row from the returned confirmed values. Also attach:

```js
saveStatus: buildMonthSaveState(bundle.month).label,
savedAt: bundle.month.saved_at,
isDirty: Boolean(bundle.month.dirty_since_save),
snapshot: bundle.month.saved_snapshot,
```

Do not change debt/savings trend semantics unless the product explicitly wants saved-only charts; the spec only requires saved monthly summary rows/details.

- [ ] **Step 5: Update `renderHistory()`**

Display `— Saved` beside saved months. If dirty, display a small secondary badge `Current month has unsaved changes` while keeping the saved values. Add a details expander with: spent, available/month-end, debt reduced, loans remaining, credits remaining, safe to save, saved time.

- [ ] **Step 6: Run tests and commit**

```bash
node --test tests/history-snapshot-model.test.mjs tests/*.test.mjs
node --check js/screens/history.js
node --check js/money-app.js
git add js/month-save-model.js js/money-app.js js/screens/history.js tests/history-snapshot-model.test.mjs
git commit -m "feat: show confirmed saved snapshots in history"
```

---

### Task 9: Cache Busting, Full Verification, and Manual Acceptance Pass

**Files:**
- Modify: `index.html`
- Modify: `sw.js`
- Modify: `.github/workflows/money-plan-verify.yml` if new files need shell assertions.

**Interfaces:**
- No new runtime interfaces; this task ships the feature safely.

- [ ] **Step 1: Add new model files to service-worker shell**

Ensure `sw.js` includes:

```js
'./js/month-save-model.js',
'./js/debt-guidance-model.js',
```

- [ ] **Step 2: Bump all relevant cache/version strings**

Use one consistent release tag, for example `20260917-month-save-v1`, in:

- `money-plan-v2.css` query string in `index.html`;
- `money-app.js` query string;
- auxiliary script query strings when changed;
- service worker registration query string;
- `CACHE_NAME` in `sw.js`.

- [ ] **Step 3: Extend CI file assertions**

Add:

```bash
grep -q 'month-save-model.js' sw.js
grep -q 'debt-guidance-model.js' sw.js
grep -q 'save-month' js/screens/overview.js
grep -q 'Emergency reserve' js/screens/settings.js
```

- [ ] **Step 4: Run the complete automated suite**

```bash
node --test tests/*.test.mjs
set -e
find js -name '*.js' -print0 | while IFS= read -r -d '' file; do node --check "$file"; done
! grep -R -E 'localStorage\.(getItem|setItem|removeItem|clear)' js index.html
! grep -R -E 'service[_-]?role' js index.html
```

Expected: all PASS, no syntax failures, no localStorage/service-role matches.

- [ ] **Step 5: Apply the Supabase migration in the connected project**

Run `supabase/migrations/20260917_month_save_debt_guidance.sql` against the existing Money Plan Supabase project. Then execute the verification queries from `supabase/tests/20260917_month_save_debt_guidance_checks.sql` and confirm all four month columns, `money_preferences`, and both RPCs exist.

- [ ] **Step 6: Manual acceptance test September**

Verify in the deployed app:

1. Overview initially shows `Not Saved` with `Save September`.
2. Pressing Save stores the month and shows `Saved` with a timestamp.
3. Editing a payment/salary/loan changes status to `Changes not saved` without locking any control.
4. `Save September Again` clears the dirty state and updates History.
5. History continues showing the previous confirmed snapshot before resave.
6. Debt & Savings Plan explains the selected debt and reason.
7. APR debt wins when APR exists; otherwise smallest balance wins.
8. Extra payment never exceeds available discretionary cash or debt balance.
9. Changing Emergency reserve changes live safe-to-save guidance.
10. No recommendation button creates a payment automatically.

- [ ] **Step 7: Commit release wiring**

```bash
git add index.html sw.js .github/workflows/money-plan-verify.yml
git commit -m "chore: ship month save and debt guidance release"
```

- [ ] **Step 8: Verify GitHub Actions and Pages deployment**

Confirm `Money Plan verify` is green and the GitHub Pages deployment for the final commit succeeds before calling the implementation complete.
