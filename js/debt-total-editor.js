import { supabase } from './supabase-client.js';
import { openSheet, field, setSheetPreview } from './money-sheets.js';
import { calculateCorrectedDebtBalance } from './money-calculations.js';

const money = (n) => `MVR ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function selectedMonthKey() {
  const title = document.getElementById('month-title')?.textContent?.trim();
  const parsed = title ? new Date(`${title} 1`) : new Date();
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
}

async function getDebtEditorModel(id) {
  const { data: debt, error: debtError } = await supabase.from('money_debts').select('*').eq('id', id).single();
  if (debtError) throw debtError;

  const { data: payments, error: paymentError } = await supabase
    .from('money_payments')
    .select('amount,reversed_at')
    .eq('payment_type', 'debt')
    .eq('debt_id', id);
  if (paymentError) throw paymentError;

  const paid = (payments || [])
    .filter((p) => !p.reversed_at)
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return { debt, paid: Number(paid.toFixed(2)) };
}

function openTotalEditor({ debt, paid }) {
  const monthKey = selectedMonthKey();
  const history = debt.monthly_plan_history && typeof debt.monthly_plan_history === 'object' ? debt.monthly_plan_history : {};
  const monthTarget = Number(history[monthKey] ?? debt.monthly_plan ?? 0);

  const preview = (opening) => {
    const next = calculateCorrectedDebtBalance(opening, paid);
    setSheetPreview(`<div class="payment-preview"><span>Recorded payments kept</span><strong>${money(paid)}</strong><span>Remaining balance after correction</span><strong>${money(next)}</strong></div>`);
  };

  openSheet({
    title: 'Edit loan / credit',
    subtitle: 'Correct the total amount without deleting recorded payments.',
    body: `${field.text('name', debt.debt_type === 'credit' ? 'Credit name' : 'Loan name', debt.name, 'required')}
      ${field.select('type', 'Type', [{ value: 'loan', label: 'Loan' }, { value: 'credit', label: 'Credit' }], debt.debt_type)}
      ${field.money('openingBalance', debt.debt_type === 'credit' ? 'Total credit amount' : 'Total loan amount', Number(debt.opening_balance || 0).toFixed(2), 'required min="0"')}
      <div class="helper">Already paid: <strong>${money(paid)}</strong>. Changing the total recalculates the balance; recorded payments remain untouched.</div>
      ${field.money('monthlyPlan', 'Payment target this month (optional)', monthTarget || '', 'min="0"')}
      ${field.number('apr', 'APR / interest % (optional)', debt.apr ?? '', 'min="0" step="0.01"')}`,
    submitLabel: 'Save account',
    onReady: (form) => {
      const input = form.querySelector('[name="openingBalance"]');
      preview(input.value);
      input.addEventListener('input', () => preview(input.value));
    },
    onSubmit: async (values) => {
      const opening = Math.max(0, Number(values.openingBalance || 0));
      if (opening < paid) throw new Error(`Total amount cannot be less than ${money(paid)} already paid.`);
      const current = calculateCorrectedDebtBalance(opening, paid);
      const plan = Math.max(0, Number(values.monthlyPlan || 0));
      const updatedHistory = monthKey ? { ...history, [monthKey]: plan } : history;
      const payload = {
        name: String(values.name || '').trim(),
        debt_type: values.type,
        opening_balance: opening,
        current_balance: current,
        monthly_plan: plan,
        monthly_plan_history: updatedHistory,
        apr: values.apr === '' ? null : Math.max(0, Number(values.apr || 0)),
        is_active: current > 0,
      };
      const { error } = await supabase.from('money_debts').update(payload).eq('id', debt.id);
      if (error) throw error;
      setTimeout(() => window.location.reload(), 60);
    },
  });
}

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action="edit-debt"]');
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  try {
    const model = await getDebtEditorModel(button.dataset.id);
    openTotalEditor(model);
  } catch (error) {
    console.error('Could not open debt editor', error);
    alert(error?.message || 'Could not open loan editor.');
  }
}, true);
