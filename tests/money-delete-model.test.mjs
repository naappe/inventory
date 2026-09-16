import test from 'node:test';
import assert from 'node:assert/strict';
import { deletionPolicyForExpenseItem } from '../js/category-behavior.js';

test('unpaid expense can remove current snapshot and future recurrence', () => {
  assert.deepEqual(deletionPolicyForExpenseItem({ paymentCount: 0 }), {
    deactivateMaster: true,
    removeCurrentSnapshot: true,
    preserveHistory: false,
  });
});

test('paid expense preserves current snapshot and history', () => {
  assert.deepEqual(deletionPolicyForExpenseItem({ paymentCount: 2 }), {
    deactivateMaster: true,
    removeCurrentSnapshot: false,
    preserveHistory: true,
  });
});
