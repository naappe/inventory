import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../js/money-api.js', import.meta.url), 'utf8');
for (const name of ['saveMonth','markMonthDirty','getMoneyPreferences','setEmergencyReserveTarget']) {
  test(`exports ${name}`, () => assert.match(src, new RegExp(`export async function ${name}\\b`)));
}
