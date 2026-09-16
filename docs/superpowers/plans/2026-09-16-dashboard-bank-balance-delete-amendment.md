# Dashboard Bank Balance + Safe Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development task-by-task.

**Goal:** Add a manual monthly bank balance, top dashboard cards/graphs for salary-paid-left-bank, and safe expense-item deletion without destroying financial history.

**Architecture:** Add `money_months.bank_balance`; expose it through the existing Money API; keep it independent from cash-flow calculations. Safe deletion soft-disables the reusable item and removes only an unpaid current-month snapshot, preserving paid/current and all historical snapshots.

**Tech Stack:** Vanilla ES modules, Supabase/Postgres/RLS, GitHub Pages, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-16-dashboard-bank-balance-delete-amendment.md`

## Global Constraints

- Current Bank Balance is manually entered per month.
- Null means not entered; zero is a valid entered bank balance.
- Bank balance does not alter salary, cash flow, debt, receivable, Still Left to Pay, or Safe to Save math.
- Financial payment rows are never destructively deleted.
- Item deletion must preserve any month snapshot that has payment history.

---

### Task A: Persist manual bank balance

**Files:**
- Create: `supabase/migrations/20260916_money_plan_bank_balance.sql`
- Modify: `js/money-api.js`
- Test: `tests/money-dashboard-model.test.mjs`

- [ ] Write a failing dashboard/model test asserting `bankBalance` is independent from `calculateMonthSummary()`.
- [ ] Add nullable `bank_balance numeric(14,2)` to `money_months` with `bank_balance >= 0` when non-null.
- [ ] Add `setBankBalance(monthId, value)` API; empty input stores null, numeric input stores a non-negative value.
- [ ] Re-run tests.

### Task B: Add safe item deletion

**Files:**
- Modify: `js/money-api.js`
- Modify: `js/money-app.js`
- Modify: `js/screens/payments.js`
- Test: `tests/money-delete-model.test.mjs`

- [ ] Write failing tests for unpaid-vs-paid deletion policy.
- [ ] Add `archiveItemForMonth(itemId, monthItemId)` API that disables the master item, checks payment history on the current snapshot, deletes that snapshot only when no payment rows exist, and returns `{ snapshotRemoved, historyPreserved }`.
- [ ] Add Delete action + confirmation sheet on Payments.
- [ ] Keep Reverse as the only correction for recorded payments.
- [ ] Re-run tests.

### Task C: Dashboard cards and graphs

**Files:**
- Modify: `js/screens/overview.js`
- Modify: `js/money-app.js`
- Modify: `js/money-charts.js`
- Modify: `money-plan.css`
- Test: `tests/money-dashboard-model.test.mjs`

- [ ] Write failing tests for Salary Received / Paid / Still Left / Bank Balance model values.
- [ ] Add Overview action to enter/edit manual Bank Balance.
- [ ] Render four primary cards at top.
- [ ] Render Paid vs Left graph, cash movement graph when data exists, and bank-balance trend when values exist.
- [ ] Keep Loans Left / Credits Left / Money Owed to Me as separate secondary balances.
- [ ] Re-run the full Money Plan suite and syntax checks.

### Task D: Verification

- [ ] Run all Node tests and JS syntax checks.
- [ ] Verify no localStorage finance code or service-role key is introduced.
- [ ] Verify Supabase column/RLS remain correct.
- [ ] Verify feature branch workflow is green before merge/deployment.
