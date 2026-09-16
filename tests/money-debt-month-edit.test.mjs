import test from 'node:test';
import assert from 'node:assert/strict';
import { debtMonthEditPreview } from '../js/debt-month-edit.js';

test('monthly debt payment can differ from previous months', () => {
  const preview = debtMonthEditPreview({
    totalAmount: 25500,
    paidBeforeMonth: 0,
    currentMonthPaid: 1000,
    newMonthPayment: 1500,
  });
  assert.equal(preview.paidBeforeMonth, 0);
  assert.equal(preview.newMonthPayment, 1500);
  assert.equal(preview.remainingBalance, 24000);
});

test('total amount cannot be reduced below payments made before the selected month', () => {
  assert.throws(() => debtMonthEditPreview({
    totalAmount: 500,
    paidBeforeMonth: 1000,
    currentMonthPaid: 0,
    newMonthPayment: 0,
  }), /below payments already made/i);
});

test('monthly payment is capped by the balance available in that month', () => {
  const preview = debtMonthEditPreview({
    totalAmount: 3000,
    paidBeforeMonth: 1000,
    currentMonthPaid: 500,
    newMonthPayment: 5000,
  });
  assert.equal(preview.newMonthPayment, 2000);
  assert.equal(preview.remainingBalance, 0);
});
