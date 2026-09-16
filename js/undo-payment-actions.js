import { supabase } from './supabase-client.js';
import { openSheet, field } from './money-sheets.js';

async function reversePayments(ids, reason) {
  for (const id of ids) {
    const { error } = await supabase.rpc('money_reverse_payment', {
      p_payment_id: id,
      p_reason: reason || 'Undo monthly payment',
    });
    if (error) throw error;
  }
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action="undo-row-payments"]');
  if (!button) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const ids = String(button.dataset.paymentIds || '').split(',').map((id) => id.trim()).filter(Boolean);
  if (!ids.length) return;
  const name = button.dataset.name || 'this item';

  openSheet({
    title: 'Undo payment?',
    subtitle: `${name} · restore this month’s recorded payment`,
    body: `${field.text('reason', 'Reason', 'Adjust monthly payment', 'required')}
      <div class="warning-box">The payment stays in History as reversed. Loan or credit balances are restored automatically. After undo, choose Pay again and enter the amount you actually want to pay this month.</div>`,
    submitLabel: 'Undo payment',
    onSubmit: async (values) => {
      await reversePayments(ids, values.reason);
      window.location.reload();
    },
  });
}, true);
