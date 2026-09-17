import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../js/money-app.js', import.meta.url), 'utf8');
test('money app wires month save models and action', () => {
  assert.match(src, /buildMonthSnapshot/);
  assert.match(src, /buildDebtGuidance/);
  assert.match(src, /action==='save-month'/);
  assert.match(src, /api\.saveMonth/);
});
