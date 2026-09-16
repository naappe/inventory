# Money Plan Dashboard / Delete Amendment

Date: 2026-09-16
Status: Approved
Applies to: `2026-09-16-category-driven-money-logic-design.md`

## Dashboard

The top of Overview must show four primary monthly cards:

1. Salary Received — the month income value entered by the user.
2. Paid This Month — actual non-reversed cash-out transactions in the selected month.
3. Still Left to Pay — unpaid planned Home/Other expense obligations plus any explicit liability target for that month.
4. Current Bank Balance — a manual month-specific value entered by the user. It is not calculated from salary or transactions.

The dashboard also keeps separate balance cards for Loans Left, Credits Left, and Money Owed to Me.

Graphs must prioritize useful financial status:

- Paid vs Left for the selected month.
- Monthly cash movement (cash in vs cash out) when historical data exists.
- Manual Bank Balance trend across months when values exist.

## Manual Bank Balance

`money_months` stores `bank_balance numeric(14,2)` nullable. Null means the user has not entered the balance for that month. Zero is a valid entered value.

The user can edit the bank balance from Overview. Changing it never changes salary, payments, debts, receivables, Still Left to Pay, or Safe to Save calculations.

## Safe Delete for Expense Items

Expense/item rows receive a Delete action with confirmation.

Deletion rules:

- The reusable `money_items` record is soft-disabled (`is_active=false`) so it will not be copied to future months.
- If the selected month snapshot has no payment records, remove that current month snapshot so it disappears from the active plan.
- If the selected month snapshot already has payment history, keep the snapshot and payment history. Do not destructively delete financial transactions.
- Historical month snapshots remain untouched.
- Recorded payments continue to use Reverse for correction.

## Tests

Add coverage proving:

- manual bank balance persists independently per month;
- bank balance does not affect calculated cash flow or liabilities;
- dashboard model exposes Salary Received, Paid, Still Left, and Bank Balance separately;
- deleting an unpaid expense removes it from current/future plans;
- deleting an item with payment history preserves the paid snapshot/history;
- deleting one expense never deletes or mutates loan/credit/receivable transactions.
