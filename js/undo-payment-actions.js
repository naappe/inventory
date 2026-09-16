import { supabase } from './supabase-client.js';
import { getMonthBundle } from './money-api.js';
import { renderPayments } from './screens/payments.js';
import { openSheet, field } from './money-sheets.js';
import { applyLocalPaymentReversal } from './instant-payment-reversal.js';

function selectedMonthKey() {
  const title = document.getElementById('month-title')?.textContent?.trim();
  const parsed = title ? new Date(`${title} 1`) : new Date();
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
}

async function reversePayment(id, reason) {
  const { data, error } = await supabase.rpc('money_reverse_payment', {
    p_payment_id: id,
    p_reason: reason || 'Undo monthly payment',
  });
  if (error) throw error;
  return data;
}

function paintPayments(bundle) {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = renderPayments(bundle);
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action="undo-row-payments"]');
  if (!button) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const ids = String(button.dataset.paymentIds || '').split(',').map((id) => id.trim()).filter(Boolean);
  if (!ids.length) return;
  const name = button.dataset.name || 'this item';
  const monthKey = selectedMonthKey();
  const bundlePromise = monthKey ? getMonthBundle(monthKey) : Promise.resolve(null);

  openSheet({
    title: 'Undo payment?',
    subtitle: `${name} · restore this month’s recorded payment`,
    body: `${field.text('reason', 'Reason', 'Adjust monthly payment', 'required')}
      <div class="warning-box">The payment stays in History as reversed. Loan or credit balances are restored automatically. After undo, choose Pay again and enter the amount you actually want to pay this month.</div>`,
    submitLabel: 'Undo payment',
    onSubmit: async (values) => {
      let bundle = await bundlePromise;
      const reversedAt = new Date().toISOString();

      for (const id of ids) {
        const debtBalance = await reversePayment(id, values.reason);
        if (bundle) bundle = applyLocalPaymentReversal(bundle, id, { reversedAt, debtBalance });
      }

      if (bundle) {
        paintPayments(bundle);
        document.getElementById('toast')?.classList.remove('show');
      }
    },
  });
}, true);
