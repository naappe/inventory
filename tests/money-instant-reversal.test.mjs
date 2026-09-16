import test from 'node:test';
import assert from 'node:assert/strict';
import { applyLocalPaymentReversal } from '../js/instant-payment-reversal.js';

test('expense reversal updates bundle locally without refetching month data', () => {
  const bundle = {
    payments: [{ id: 'p1', payment_type: 'expense', month_item_id: 'mi1', amount: 700, reversed_at: null }],
    debts: [],
  };
  const next = applyLocalPaymentReversal(bundle, 'p1', { reversedAt: '2026-09-16T06:30:00Z' });
  assert.equal(next.payments[0].reversed_at, '2026-09-16T06:30:00Z');
  assert.notEqual(next, bundle);
  assert.notEqual(next.payments, bundle.payments);
});

test('debt reversal restores the returned database balance immediately', () => {
  const bundle = {
    payments: [{ id: 'd1', payment_type: 'debt', debt_id: 'loan1', amount: 1000, reversed_at: null }],
    debts: [{ id: 'loan1', current_balance: 24500, is_active: true }],
  };
  const next = applyLocalPaymentReversal(bundle, 'd1', {
    reversedAt: '2026-09-16T06:30:00Z',
    debtBalance: 25500,
  });
  assert.equal(next.payments[0].reversed_at, '2026-09-16T06:30:00Z');
  assert.equal(next.debts[0].current_balance, 25500);
  assert.equal(next.debts[0].is_active, true);
});

test('reversal rejects an unknown payment id instead of silently corrupting local state', () => {
  assert.throws(
    () => applyLocalPaymentReversal({ payments: [], debts: [] }, 'missing', { reversedAt: 'x' }),
    /Payment not found/
  );
});
