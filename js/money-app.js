import { ALLOWED_EMAIL, FIRST_MONTH } from './config.js';
import { getAllowedSession, signIn, signOut } from './auth.js';
import * as api from './money-api.js';
import { calculateDebtPreview, calculateMonthSummary, itemPaymentTotal } from './money-calculations.js';
import { openSheet, field, setSheetPreview } from './money-sheets.js';
import { renderSetup } from './screens/setup.js';
import { renderOverview } from './screens/overview.js';
import { renderPayments } from './screens/payments.js';
import { renderDebts } from './screens/debts.js';
import { renderHistory } from './screens/history.js';
import { renderSettings } from './screens/settings.js';

const state = {
  session: null,
  user: null,
  view: 'overview',
  monthKey: FIRST_MONTH,
  bundle: null,
  items: [],
  months: [],
  historyModel: null,
  setupMode: false,
};

const app = document.getElementById('app');
const sidebar = document.getElementById('sidebar');
const topbar = document.getElementById('topbar');
const toastNode = document.getElementById('toast');
const money = (n) => `MVR ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function monthLabel(key) {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function shiftKey(key, delta) {
  const [year, month] = key.split('-').map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function todayForMonth(key) {
  const today = new Date();
  const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  if (current === key) return `${key}-${String(today.getDate()).padStart(2, '0')}`;
  return `${key}-01`;
}

function toast(message, tone = 'success') {
  toastNode.textContent = message;
  toastNode.dataset.tone = tone;
  toastNode.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toastNode.classList.remove('show'), 2600);
}

function showBusy(message = 'Loading your money plan…') {
  app.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>${message}</p></div>`;
}

function renderLogin(error = '') {
  sidebar.hidden = true;
  topbar.hidden = true;
  app.innerHTML = `<section class="login-page"><div class="login-card">
    <div class="brand-mark large-mark">◒</div><p class="eyebrow">PRIVATE MONEY PLAN</p><h1>Welcome back</h1><p>Sign in with your Supabase account. Only ${ALLOWED_EMAIL} is allowed.</p>
    <form data-login-form><label class="field"><span>Email</span><input type="email" value="${ALLOWED_EMAIL}" disabled></label><label class="field"><span>Password</span><input name="password" type="password" autocomplete="current-password" required></label>${error ? `<p class="form-error">${error}</p>` : ''}<button class="button primary full large" type="submit">Sign in</button></form>
    <small class="privacy-note">Finance data is stored in Supabase. It is not kept in browser localStorage.</small>
  </div></section>`;
}

function renderChrome() {
  sidebar.hidden = false;
  topbar.hidden = false;
  document.getElementById('month-title').textContent = monthLabel(state.monthKey);
  document.getElementById('prev-month').disabled = state.monthKey <= FIRST_MONTH || state.setupMode;
  document.getElementById('next-month').disabled = state.setupMode;
  document.querySelectorAll('[data-view]').forEach((el) => el.classList.toggle('active', el.dataset.view === state.view));
  const email = document.getElementById('account-email');
  if (email) email.textContent = state.user?.email || '';
}

function render() {
  if (!state.session) return renderLogin();
  renderChrome();
  if (state.setupMode) {
    app.innerHTML = renderSetup({ month: state.bundle.month, categories: state.bundle.categories, items: state.items, debts: state.bundle.debts });
    return;
  }
  if (state.view === 'overview') app.innerHTML = renderOverview(state.bundle);
  if (state.view === 'payments') app.innerHTML = renderPayments(state.bundle);
  if (state.view === 'debts') app.innerHTML = renderDebts(state.bundle);
  if (state.view === 'settings') app.innerHTML = renderSettings({ user: state.user, categories: state.bundle.categories, items: state.items });
  if (state.view === 'history') app.innerHTML = state.historyModel ? renderHistory(state.historyModel) : `<div class="loading-state"><div class="spinner"></div><p>Building history…</p></div>`;
}

async function loadMonth() {
  state.bundle = await api.getMonthBundle(state.monthKey);
  state.items = await api.listItems();
  state.months = await api.listMonths();
  state.setupMode = state.monthKey === FIRST_MONTH && state.bundle.month.setup_complete !== true;
  state.historyModel = null;
}

async function enterApp(session) {
  state.session = session;
  state.user = session.user;
  showBusy();
  let months = await api.listMonths();
  if (!months.length) {
    await api.bootstrapSeptember();
    months = await api.listMonths();
  }
  state.months = months;
  state.monthKey = months.some((m) => m.month_key === FIRST_MONTH) ? FIRST_MONTH : (months[0]?.month_key || FIRST_MONTH);
  await loadMonth();
  render();
}

async function reload(message) {
  await loadMonth();
  render();
  if (message) toast(message);
}

function openIncomeSheet() {
  openSheet({
    title: 'Monthly income',
    subtitle: monthLabel(state.monthKey),
    body: `${field.money('income', 'Income for this month', state.bundle.month.income, 'required')}<p class="helper">This is the starting income used for Available Now and Safe to Save.</p>`,
    submitLabel: 'Save income',
    onSubmit: async (values) => { await api.setIncome(state.bundle.month.id, values.income); await reload('Income updated'); },
  });
}

function openAddItemSheet(item = null) {
  const options = state.bundle.categories.map((c) => ({ value: c.id, label: c.name }));
  openSheet({
    title: item ? 'Edit payment item' : 'Add payment item',
    subtitle: item ? 'Changes apply to future month snapshots.' : 'Create a reusable monthly payment.',
    body: `${field.text('name', 'Name', item?.name || '', 'required')}${field.select('categoryId', 'Category', options, item?.category_id || options[0]?.value || '')}${field.money('plannedAmount', 'Monthly planned amount', item?.default_planned_amount || '', 'required')}${field.number('dueDay', 'Due day (optional)', item?.due_day || '', 'min="1" max="31"')}<label class="check-field"><input name="recurring" type="checkbox" ${item?.is_recurring === false ? '' : 'checked'}><span>Repeat this item each new month</span></label>`,
    submitLabel: item ? 'Save changes' : 'Add item',
    onSubmit: async (values, form) => {
      const recurring = form.querySelector('[name="recurring"]').checked;
      if (item) await api.updateItem(item.id, { ...values, recurring });
      else await api.createItem({ ...values, recurring });
      await api.createMonth(state.monthKey);
      await reload(item ? 'Payment item updated' : 'Payment item added');
    },
  });
}

function openAddDebtSheet(debt = null) {
  openSheet({
    title: debt ? 'Edit debt plan' : 'Add loan or credit',
    subtitle: debt ? 'The current balance changes through recorded payments.' : 'Enter the real balance you owe today.',
    body: `${field.text('name', 'Debt name', debt?.name || '', 'required')}${field.select('type', 'Type', [{ value: 'loan', label: 'Loan' }, { value: 'credit', label: 'Credit' }], debt?.debt_type || 'loan')}${debt ? '' : field.money('balance', 'Current balance', '', 'required')}${field.money('monthlyPlan', 'Planned payment each month', debt?.monthly_plan || '', 'required')}${field.number('apr', 'APR / interest % (optional)', debt?.apr ?? '', 'min="0" step="0.01"')}`,
    submitLabel: debt ? 'Save debt plan' : 'Add debt',
    onSubmit: async (values) => {
      if (debt) await api.updateDebt(debt.id, values, state.monthKey);
      else await api.createDebt({ ...values, startMonthKey: state.monthKey });
      await reload(debt ? 'Debt plan updated' : 'Debt added');
    },
  });
}

function openItemPaymentSheet(item) {
  const paid = itemPaymentTotal(item.id, state.bundle.payments);
  const remaining = Math.max(0, Number(item.planned_amount || 0) - paid);
  openSheet({
    title: 'Record payment',
    subtitle: `${item.name_snapshot} · ${money(remaining)} remaining on plan`,
    body: `${field.money('amount', 'Amount actually paid', remaining.toFixed(2), 'required min="0.01"')}${field.date('date', 'Payment date', todayForMonth(state.monthKey), 'required')}${field.text('note', 'Note (optional)', '')}`,
    submitLabel: 'Save payment',
    onSubmit: async (values) => {
      await api.recordPayment({ monthId: state.bundle.month.id, type: 'expense', amount: values.amount, date: values.date, monthItemId: item.id, note: values.note });
      await reload('Payment saved');
    },
  });
}

function openDebtPaymentSheet(debt) {
  const suggested = Math.min(Number(debt.monthly_plan || 0) || Number(debt.current_balance || 0), Number(debt.current_balance || 0));
  const renderPreview = (amount) => {
    const preview = calculateDebtPreview(debt.current_balance, amount);
    setSheetPreview(`<div class="payment-preview"><span>Balance after this payment</span><strong>${money(preview.afterPayment)}</strong>${preview.effectiveAmount < Number(amount || 0) ? '<small>Payment is capped at the remaining debt balance.</small>' : ''}</div>`);
  };
  openSheet({
    title: 'Record debt payment',
    subtitle: `${debt.name} · current balance ${money(debt.current_balance)}`,
    body: `${field.money('amount', 'Amount paid', suggested.toFixed(2), 'required min="0.01"')}${field.date('date', 'Payment date', todayForMonth(state.monthKey), 'required')}${field.text('note', 'Note (optional)', '')}`,
    submitLabel: 'Save debt payment',
    onReady: (form) => { const input = form.querySelector('[name="amount"]'); renderPreview(input.value); input.addEventListener('input', () => renderPreview(input.value)); },
    onSubmit: async (values) => {
      const result = await api.recordPayment({ monthId: state.bundle.month.id, type: 'debt', amount: values.amount, date: values.date, debtId: debt.id, note: values.note });
      await reload(`Payment saved · balance ${money(result?.debt_balance ?? 0)}`);
    },
  });
}

function openReverseSheet(payment) {
  openSheet({
    title: 'Reverse payment?',
    subtitle: `${money(payment.amount)} will be marked as reversed. The original record stays in history.`,
    body: `${field.text('reason', 'Reason', 'Correction', 'required')}<div class="warning-box">This is the safe way to correct a financial payment. Debt balances will be restored automatically when relevant.</div>`,
    submitLabel: 'Reverse payment',
    onSubmit: async (values) => { await api.reversePayment(payment.id, values.reason); await reload('Payment reversed'); },
  });
}

function openCategorySheet() {
  openSheet({
    title: 'Add category',
    body: field.text('name', 'Category name', '', 'required'),
    submitLabel: 'Add category',
    onSubmit: async (values) => { await api.createCategory(values.name); await reload('Category added'); },
  });
}

function openQuickAdd() {
  openSheet({
    title: 'What do you want to add?',
    body: field.select('kind', 'Choose action', [
      { value: 'item', label: 'Monthly payment item' },
      { value: 'debt', label: 'Loan or credit' },
      { value: 'income', label: 'Update monthly income' },
    ], 'item'),
    submitLabel: 'Continue',
    onSubmit: async (values) => {
      queueMicrotask(() => {
        if (values.kind === 'debt') openAddDebtSheet();
        else if (values.kind === 'income') openIncomeSheet();
        else openAddItemSheet();
      });
    },
  });
}

async function buildHistoryModel() {
  const raw = await api.historyData();
  const rows = [];
  const debtTrend = [];
  const savingsTrend = [];
  const cumulativeDebtPayments = new Map();

  for (const bundle of raw.bundles) {
    for (const p of bundle.payments.filter((p) => !p.reversed_at && p.payment_type === 'debt')) {
      cumulativeDebtPayments.set(p.debt_id, (cumulativeDebtPayments.get(p.debt_id) || 0) + Number(p.amount || 0));
    }
    const monthDebts = raw.debts
      .filter((d) => String(d.start_month_key || FIRST_MONTH) <= bundle.month.month_key)
      .map((d) => {
        const planHistory = d.monthly_plan_history && typeof d.monthly_plan_history === 'object' ? d.monthly_plan_history : {};
        return {
          ...d,
          current_balance: Math.max(0, Number(d.opening_balance || 0) - (cumulativeDebtPayments.get(d.id) || 0)),
          monthly_plan: Number(planHistory[bundle.month.month_key] ?? d.monthly_plan ?? 0),
        };
      });
    const summary = calculateMonthSummary({ income: bundle.month.income, monthItems: bundle.monthItems, payments: bundle.payments, debts: monthDebts });
    const label = monthLabel(bundle.month.month_key).replace(' 20', ' ’');
    rows.push({ label: monthLabel(bundle.month.month_key), income: summary.income, paid: summary.paid, stillToPay: summary.stillToPay, safeToSave: summary.safeToSave, paymentCount: bundle.payments.filter((p) => !p.reversed_at).length });
    debtTrend.push({ label, value: monthDebts.reduce((sum, d) => sum + Number(d.current_balance || 0), 0) });
    savingsTrend.push({ label, value: summary.safeToSave });
  }
  return { rows, debtTrend, savingsTrend };
}

async function selectView(view) {
  if (state.setupMode) {
    toast('Finish September setup first.', 'error');
    return;
  }
  state.view = view;
  if (view === 'history' && !state.historyModel) {
    render();
    state.historyModel = await buildHistoryModel();
  }
  render();
}

async function changeMonth(delta) {
  if (state.setupMode) {
    toast('Finish September setup first.', 'error');
    return;
  }
  const next = shiftKey(state.monthKey, delta);
  if (next < FIRST_MONTH) return;
  showBusy('Opening month…');
  await api.createMonth(next);
  state.monthKey = next;
  await loadMonth();
  render();
}

async function handleAction(action, source) {
  if (action === 'set-income') return openIncomeSheet();
  if (action === 'add-item') return openAddItemSheet();
  if (action === 'add-debt') return openAddDebtSheet();
  if (action === 'add-category') return openCategorySheet();
  if (action === 'quick-add') return openQuickAdd();
  if (action === 'sign-out') { await signOut(); state.session = null; state.user = null; return renderLogin(); }
  if (action === 'finish-setup') {
    await api.createMonth(FIRST_MONTH);
    await api.markSetupComplete(state.bundle.month.id);
    state.setupMode = false;
    state.view = 'overview';
    await reload('September plan started');
    return;
  }
  if (action === 'pay-item') { const item = state.bundle.monthItems.find((x) => x.id === source.dataset.id); if (item) return openItemPaymentSheet(item); }
  if (action === 'pay-debt') { const debt = state.bundle.debts.find((x) => x.id === source.dataset.id); if (debt) return openDebtPaymentSheet(debt); }
  if (action === 'edit-debt') { const debt = state.bundle.debts.find((x) => x.id === source.dataset.id); if (debt) return openAddDebtSheet(debt); }
  if (action === 'edit-item') { const item = state.items.find((x) => x.id === source.dataset.id); if (item) return openAddItemSheet(item); }
  if (action === 'reverse-payment') { const payment = state.bundle.payments.find((x) => x.id === source.dataset.id); if (payment) return openReverseSheet(payment); }
}

document.addEventListener('click', async (event) => {
  const viewTarget = event.target.closest('[data-view]');
  if (viewTarget) { event.preventDefault(); try { await selectView(viewTarget.dataset.view); } catch (e) { toast(e.message, 'error'); } return; }
  const actionTarget = event.target.closest('[data-action]');
  if (actionTarget) { event.preventDefault(); try { await handleAction(actionTarget.dataset.action, actionTarget); } catch (e) { toast(e.message || 'Something went wrong.', 'error'); } }
});

document.addEventListener('submit', async (event) => {
  const form = event.target.closest('[data-login-form]');
  if (!form) return;
  event.preventDefault();
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Signing in…';
  try {
    const session = await signIn(new FormData(form).get('password'));
    await enterApp(session);
  } catch (error) {
    renderLogin(error?.message || 'Could not sign in.');
  }
});

document.getElementById('prev-month').addEventListener('click', () => changeMonth(-1).catch((e) => toast(e.message, 'error')));
document.getElementById('next-month').addEventListener('click', () => changeMonth(1).catch((e) => toast(e.message, 'error')));

(async function start() {
  try {
    const session = await getAllowedSession();
    if (!session) renderLogin();
    else await enterApp(session);
  } catch (error) {
    renderLogin(error?.message || 'Could not start My Money Plan.');
  }
})();
