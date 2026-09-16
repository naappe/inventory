import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentStatus, calculateDebtPreview } from '../js/money-calculations.js';
import { moneyFlowModel, trendModel } from '../js/money-charts.js';

test('payment status is waiting partial or paid', () => {
  assert.equal(paymentStatus(1000, 0), 'Waiting');
  assert.equal(paymentStatus(1000, 300), 'Partial');
  assert.equal(paymentStatus(1000, 1000), 'Paid');
});

test('money flow chart keeps exact finance values', () => {
  assert.deepEqual(moneyFlowModel({ income: 25000, paid: 12000, stillToPay: 8000, safeToSave: 5000 }), [
    { label: 'Income', value: 25000, tone: 'income' },
    { label: 'Paid', value: 12000, tone: 'paid' },
    { label: 'Still to pay', value: 8000, tone: 'pending' },
    { label: 'Safe to save', value: 5000, tone: 'saving' },
  ]);
});

test('zero trend produces explicit empty model', () => {
  assert.deepEqual(trendModel([]), { empty: true, points: [], min: 0, max: 0 });
});

test('payment preview caps at debt balance', () => {
  assert.deepEqual(calculateDebtPreview(500, 900), { effectiveAmount: 500, afterPayment: 0 });
});
