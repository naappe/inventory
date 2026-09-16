import test from 'node:test';
import assert from 'node:assert/strict';
import { behaviorForCategory, formModeForBehavior } from '../js/category-behavior.js';
import { calculateMonthSummary } from '../js/money-calculations.js';

test('category behavior selects the accounting form mode', () => {
  assert.equal(behaviorForCategory({ behavior_type: 'liability' }), 'liability');
  assert.equal(formModeForBehavior('liability'), 'liability-payment');
  assert.equal(formModeForBehavior('expense'), 'expense-payment');
  assert.equal(formModeForBehavior('receivable'), 'receivable');
});

test('expense payment changes cash without changing liability totals', () => {
  const summary = calculateMonthSummary({
    income: 10000,
    monthItems: [{ id: 'e1', planned_amount: 1000 }],
    payments: [{ payment_type: 'expense', month_item_id: 'e1', amount: 600 }],
    debts: [{ id: 'd1', debt_type: 'loan', current_balance: 9000, monthly_plan: 0 }],
  });
  assert.equal(summary.availableNow, 9400);
  assert.equal(summary.loansLeft, 9000);
});

test('loan and credit balances remain separated', () => {
  const summary = calculateMonthSummary({
    debts: [
      { id: 'l', debt_type: 'loan', current_balance: 7000 },
      { id: 'c', debt_type: 'credit', current_balance: 2500 },
    ],
  });
  assert.equal(summary.loansLeft, 7000);
  assert.equal(summary.creditLeft, 2500);
});
