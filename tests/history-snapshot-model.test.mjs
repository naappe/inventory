import test from 'node:test';
import assert from 'node:assert/strict';
import { historyValuesForMonth } from '../js/month-save-model.js';

const live = { income:25000, paid:7000, stillToPay:3000, safeToSave:4000, availableNow:26000, debtReduced:2000, loansRemaining:50000, creditsRemaining:7000 };
const snapshot = { salaryReceived:24000, spentThisMonth:6500, stillToPay:3500, safeToSave:3000, availableNow:25000, debtReduced:1500, loansRemaining:51000, creditsRemaining:7000 };

test('unsaved month returns live values', () => {
  const values = historyValuesForMonth({ month:{}, live });
  assert.equal(values.source, 'live');
  assert.equal(values.paid, 7000);
});

test('saved month returns snapshot values', () => {
  const values = historyValuesForMonth({ month:{ saved_snapshot:snapshot }, live });
  assert.equal(values.source, 'saved');
  assert.equal(values.paid, 6500);
  assert.equal(values.debtReduced, 1500);
});

test('dirty saved month still returns last confirmed snapshot', () => {
  const values = historyValuesForMonth({ month:{ saved_snapshot:snapshot, dirty_since_save:true }, live:{ ...live, paid:9999 } });
  assert.equal(values.source, 'saved');
  assert.equal(values.paid, 6500);
});
