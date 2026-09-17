import { supabase } from './supabase-client.js';
import { markMonthDirty } from './money-api.js';
import { openSheet, field, setSheetPreview } from './money-sheets.js';
import { debtMonthEditPreview } from './debt-month-edit.js';

const money = (n) => `MVR ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const currentMonthId = () => document.getElementById('app')?.dataset.monthId || null;
async function dirtyCurrentMonth(){const id=currentMonthId();if(id)await markMonthDirty(id);}

function selectedMonthKey() {
  const title = document.getElementById('month-title')?.textContent?.trim();
  const parsed = title ? new Date(`${title} 1`) : new Date();
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
}

function defaultDateForMonth(monthKey) {
  const today = new Date();
  const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  return current === monthKey ? `${monthKey}-${String(today.getDate()).padStart(2, '0')}` : `${monthKey}-01`;
}

async function getDebtEditorModel(id) {
  const monthKey = selectedMonthKey();
  if (!monthKey) throw new Error('Could not determine the selected month.');
  const [{ data: debt, error: debtError }, { data: month, error: monthError }] = await Promise.all([
    supabase.from('money_debts').select('*').eq('id', id).single(),
    supabase.from('money_months').select('id,month_key').eq('month_key', monthKey).single(),
  ]);
  if (debtError) throw debtError;
  if (monthError) throw monthError;
  const { data: payments, error: paymentError } = await supabase.from('money_payments').select('id,month_id,amount,payment_date,reversed_at,created_at').eq('payment_type', 'debt').eq('debt_id', id).order('payment_date', { ascending: false }).order('created_at', { ascending: false });
  if (paymentError) throw paymentError;
  const active = (payments || []).filter((p) => !p.reversed_at);
  const thisMonthRows = active.filter((p) => p.month_id === month.id);
  const currentMonthPaid = thisMonthRows.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const paidOtherMonths = active.filter((p) => p.month_id !== month.id).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const paymentDate = thisMonthRows[0]?.payment_date || defaultDateForMonth(monthKey);
  return { debt, month, monthKey, currentMonthPaid: Number(currentMonthPaid.toFixed(2)), paidOtherMonths: Number(paidOtherMonths.toFixed(2)), paymentDate };
}

function openMonthlyDebtEditor({ debt, month, monthKey, currentMonthPaid, paidOtherMonths, paymentDate }) {
  const history = debt.monthly_plan_history && typeof debt.monthly_plan_history === 'object' ? debt.monthly_plan_history : {};
  const monthTarget = Number(history[monthKey] ?? debt.monthly_plan ?? 0);
  const preview = (form) => {
    try {
      const opening = form.querySelector('[name="openingBalance"]')?.value || 0;
      const monthPayment = form.querySelector('[name="monthPayment"]')?.value || 0;
      const next = debtMonthEditPreview({ totalAmount: opening, paidBeforeMonth: paidOtherMonths, currentMonthPaid, newMonthPayment: monthPayment });
      setSheetPreview(`<div class="payment-preview"><span>Paid in other months</span><strong>${money(next.paidBeforeMonth)}</strong><span>This month payment</span><strong>${money(next.newMonthPayment)}</strong><span>Remaining balance after save</span><strong>${money(next.remainingBalance)}</strong></div>`);
    } catch (error) { setSheetPreview(`<div class="warning-box">${error.message}</div>`); }
  };
  openSheet({
    title: 'Edit loan / credit',
    subtitle: 'Set a different payment for each month without deleting the payment history.',
    body: `${field.text('name', debt.debt_type === 'credit' ? 'Credit name' : 'Loan name', debt.name, 'required')}${field.select('type', 'Type', [{ value: 'loan', label: 'Loan' }, { value: 'credit', label: 'Credit' }], debt.debt_type)}${field.money('openingBalance', debt.debt_type === 'credit' ? 'Total credit amount' : 'Total loan amount', Number(debt.opening_balance || 0).toFixed(2), 'required min="0"')}<div class="helper">Paid in other months: <strong>${money(paidOtherMonths)}</strong>. Those records stay unchanged.</div>${field.money('monthPayment', `Payment for ${document.getElementById('month-title')?.textContent?.trim() || monthKey}`, currentMonthPaid ? currentMonthPaid.toFixed(2) : '', 'min="0"')}${field.date('paymentDate', 'Payment date', paymentDate, 'required')}<div class="helper">This amount belongs only to the selected month. Next month can be a completely different amount.</div>${field.money('monthlyPlan', 'Payment target this month (optional)', monthTarget || '', 'min="0"')}${field.number('apr', 'APR / interest % (optional)', debt.apr ?? '', 'min="0" step="0.01"')}`,
    submitLabel: 'Save account',
    onReady: (form) => { preview(form); form.querySelector('[name="openingBalance"]')?.addEventListener('input', () => preview(form)); form.querySelector('[name="monthPayment"]')?.addEventListener('input', () => preview(form)); },
    onSubmit: async (values) => {
      const opening = Math.max(0, Number(values.openingBalance || 0));
      const requestedMonthPayment = Math.max(0, Number(values.monthPayment || 0));
      const model = debtMonthEditPreview({ totalAmount: opening, paidBeforeMonth: paidOtherMonths, currentMonthPaid, newMonthPayment: requestedMonthPayment });
      const plan = Math.max(0, Number(values.monthlyPlan || 0));
      const apr = values.apr === '' ? null : Math.max(0, Number(values.apr || 0));
      const { data, error } = await supabase.rpc('money_edit_debt_month', { p_debt_id: debt.id, p_month_id: month.id, p_name: String(values.name || '').trim(), p_debt_type: values.type, p_total_amount: opening, p_monthly_plan: plan, p_apr: apr, p_month_payment: model.newMonthPayment, p_payment_date: values.paymentDate });
      if (error) throw error;
      await dirtyCurrentMonth();
      const result = Array.isArray(data) ? data[0] : data;
      setSheetPreview(`<div class="payment-preview"><span>Saved this month</span><strong>${money(result?.effective_payment ?? model.newMonthPayment)}</strong><span>Loan / credit left</span><strong>${money(result?.debt_balance ?? model.remainingBalance)}</strong></div>`);
      setTimeout(() => window.location.reload(), 80);
    },
  });
}

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action="edit-debt"]');
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  try { const model = await getDebtEditorModel(button.dataset.id); openMonthlyDebtEditor(model); }
  catch (error) { console.error('Could not open debt editor', error); alert(error?.message || 'Could not open loan editor.'); }
}, true);
