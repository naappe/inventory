import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const settings = fs.readFileSync(new URL('../js/screens/settings.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../js/money-app.js', import.meta.url), 'utf8');
test('settings exposes emergency reserve editor', () => {
  assert.match(settings, /Emergency reserve/);
  assert.match(settings, /set-emergency-reserve/);
  assert.match(app, /action==='set-emergency-reserve'/);
  assert.match(app, /setEmergencyReserveTarget/);
});
