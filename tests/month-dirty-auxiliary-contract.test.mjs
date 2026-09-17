import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = ['debt-total-editor.js','debt-delete-actions.js','receivable-edit-actions.js','undo-payment-actions.js'];
for (const file of files) {
  test(`${file} marks the selected month dirty after mutations`, () => {
    const src = fs.readFileSync(new URL(`../js/${file}`, import.meta.url), 'utf8');
    assert.match(src, /markMonthDirty/);
    assert.match(src, /dataset\.monthId/);
  });
}
