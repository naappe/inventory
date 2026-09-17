import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../js/screens/overview.js', import.meta.url), 'utf8');
test('overview renders save status and debt guidance', () => {
  assert.match(src, /buildMonthSaveState/);
  assert.match(src, /buildDebtGuidance/);
  assert.match(src, /save-month/);
  assert.match(src, /Debt & Savings Plan/);
  assert.match(src, /Changes not saved/);
  assert.match(src, /Emergency reserve/);
});
