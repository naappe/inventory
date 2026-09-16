import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCorrectedDebtBalance } from '../js/money-calculations.js';

test('correcting the total loan amount preserves real payments and recalculates the remaining balance', () => {
  assert.equal(calculateCorrectedDebtBalance(12000, 1000), 11000);
  assert.equal(calculateCorrectedDebtBalance(9000, 1000), 8000);
});

test('remaining balance never goes below zero after a correction', () => {
  assert.equal(calculateCorrectedDebtBalance(500, 1000), 0);
});
