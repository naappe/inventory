import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPaymentsPageModel } from '../js/payments-page-model.js';

test('expense row exposes active payment ids so a paid item can be undone and paid again', () => {
  const model = buildPaymentsPageModel({
    month: { income: 0, bank_balance: 0 },
    monthItems: [{ id: 'mi1', item_id: 'i1', name_snapshot: 'Electricity', category_snapshot: 'Home Expenses', planned_amount: 700 }],
    payments: [
      { id: 'p1', payment_type: 'expense', month_item_id: 'mi1', amount: 700, reversed_at: null, payment_date: '2026-09-10' },
      { id: 'old', payment_type: 'expense', month_item_id: 'mi1', amount: 100, reversed_at: '2026-09-11T00:00:00Z', payment_date: '2026-09-09' },
    ],
    debts: [], receivables: [], receivableTransactions: [],
  });
  assert.deepEqual(model.expenses[0].activePaymentIds, ['p1']);
  assert.equal(model.expenses[0].canUndoPayment, true);
});

test('loan row exposes every active payment id for the selected month', () => {
  const model = buildPaymentsPageModel({
    month: { income: 0, bank_balance: 0 },
    monthItems: [],
    payments: [
      { id: 'd1', payment_type: 'debt', debt_id: 'loan1', amount: 600, reversed_at: null, payment_date: '2026-09-05' },
      { id: 'd2', payment_type: 'debt', debt_id: 'loan1', amount: 400, reversed_at: null, payment_date: '2026-09-12' },
      { id: 'd3', payment_type: 'debt', debt_id: 'loan1', amount: 200, reversed_at: '2026-09-13T00:00:00Z', payment_date: '2026-09-01' },
    ],
    debts: [{ id: 'loan1', name: 'Council', debt_type: 'loan', current_balance: 24500, monthly_plan: 0 }],
    receivables: [], receivableTransactions: [],
  });
  assert.deepEqual(model.loans[0].activePaymentIds, ['d1', 'd2']);
  assert.equal(model.loans[0].canUndoPayment, true);
  assert.equal(model.loans[0].paidThisMonth, 1000);
});
