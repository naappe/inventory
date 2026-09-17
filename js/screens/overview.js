import { calculateMonthSummary, itemPaymentTotal, paymentStatus } from '../money-calculations.js';
import { buildDashboardModel } from '../money-dashboard-model.js';
import { buildMonthSaveState } from '../month-save-model.js';
import { buildDebtGuidance } from '../debt-guidance-model.js';
import { renderMoneyFlowChart, renderCompositionDonut, renderTrendLine } from '../money-charts.js';

const money = (n) => `MVR ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shortDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : 'No due date';
const savedTime = (value) => value ? new Date(value).toLocaleString('en-US', { day:'numeric', month:'short', year:'numeric', hour:'numeric', minute:'2-digit' }) : '';

function snapshotComparison(month, model) {
  if (!month.dirty_since_save || !month.saved_snapshot || typeof month.saved_snapshot !== 'object') return '';
  const s = month.saved_snapshot;
  const rows = [
    ['Spent this month', s.spentThisMonth, model.paidThisMonth],
    ['Available now', s.availableNow, model.availableNow],
    ['Still to pay', s.stillToPay, model.stillLeftToPay],
    ['Expected month-end', s.expectedMonthEnd, model.expectedAfterBills],
  ];
  return `<details class="snapshot-compare"><summary>See what changed since the last save</summary><div class="snapshot-compare-grid"><div class="snapshot-head"><span>Item</span><span>Last saved</span><span>Current</span></div>${rows.map(([label,saved,current])=>`<div><span>${label}</span><strong>${money(saved)}</strong><strong>${money(current)}</strong></div>`).join('')}</div></details>`;
}

function monthSaveCard(month, model) {
  const state = buildMonthSaveState(month);
  const dirtyCopy = state.status === 'dirty' ? 'You changed this month after the last save. Review the figures and save again when ready.' : '';
  const savedCopy = state.status === 'saved' ? `Saved ${savedTime(state.savedAt)}. You can still modify anything if needed.` : '';
  const unsavedCopy = state.status === 'not-saved' ? 'Finish your entries, then save this month’s confirmed summary.' : '';
  return `<article class="month-save-card ${state.status === 'dirty' ? 'is-dirty' : state.status === 'saved' ? 'is-saved' : ''}">
    <div class="month-save-main"><div><p class="eyebrow">MONTH STATUS</p><div class="month-status ${state.status === 'dirty' ? 'is-dirty' : state.status === 'saved' ? 'is-saved' : ''}">${state.label}</div><h2>${state.status === 'dirty' ? 'Changes not saved' : state.label === 'Saved' ? 'Month saved' : 'Ready when you are'}</h2><p>${dirtyCopy || savedCopy || unsavedCopy}</p></div>${state.buttonLabel ? `<button class="button primary" data-action="save-month">${state.buttonLabel}</button>` : '<span class="saved-check">✓ Confirmed</span>'}</div>
    ${snapshotComparison(month, model)}
  </article>`;
}

function guidancePanel(guidance) {
  const focus = guidance.focusDebt;
  const next = guidance.nextDebt;
  return `<article class="panel debt-guidance-panel">
    <div class="panel-head"><div><p class="eyebrow">DEBT & SAVINGS PLAN</p><h2>Debt & Savings Plan</h2><p>Guidance only — nothing here makes a payment automatically.</p></div><div class="safe-save-callout"><small>Safe to save</small><strong>${money(guidance.safeToSave)}</strong></div></div>
    <div class="guidance-grid">
      <section class="focus-debt-card"><span>Focus debt</span>${focus ? `<h3>${focus.name}</h3><strong>${money(focus.current_balance)}</strong><small>${focus.debt_type === 'credit' ? 'Credit' : 'Loan'}${Number(focus.apr || 0) > 0 ? ` · ${Number(focus.apr).toFixed(2)}% APR` : ' · APR not entered'}</small>` : '<h3>No active loan or credit remains.</h3>'}</section>
      <section><span>Why this debt</span><p>${guidance.reason}</p></section>
      <section><span>Suggested extra payment</span><strong>${guidance.suggestedExtraPayment > 0 ? money(guidance.suggestedExtraPayment) : 'No extra payment suggested yet'}</strong></section>
      <section><span>Balance after suggested extra</span><strong>${focus ? money(guidance.projectedFocusBalance) : '—'}</strong></section>
      <section><span>Cash freed after payoff</span><strong>${focus && guidance.cashFreedAfterPayoff > 0 ? `${money(guidance.cashFreedAfterPayoff)} / month` : 'No monthly target entered'}</strong></section>
      <section><span>Next debt</span><strong>${next ? `${next.name} · ${money(next.current_balance)}` : 'None after current focus'}</strong></section>
      <section><span>Safe to save</span><strong>${money(guidance.safeToSave)}</strong><small>After remaining plans and reserve.</small></section>
      <section><span>Emergency reserve</span><strong>${money(guidance.emergencyReserve)}</strong><button class="text-button" data-view="settings">Settings</button></section>
    </div>
  </article>`;
}

export function renderOverview(bundle) {
  const { month, monthItems = [], payments = [], debts = [], receivables = [], receivableTransactions = [], bankHistory = [] } = bundle;
  const summary = calculateMonthSummary({ income: month.income, monthItems, payments, debts, receivables, receivableTransactions });
  const model = buildDashboardModel({ month, summary });
  const saveState = buildMonthSaveState(month);
  const guidance = buildDebtGuidance({ debts, availableNow:model.availableNow, stillToPay:model.stillLeftToPay, emergencyReserve:bundle.preferences?.emergency_reserve_target || 0 });
  const upcoming = monthItems.map((item) => {
    const paid = itemPaymentTotal(item.id, payments);
    return { ...item, paid, remaining: Math.max(0, Number(item.planned_amount || 0) - paid), status: paymentStatus(item.planned_amount, paid) };
  }).filter((item) => item.remaining > 0).sort((a,b)=>String(a.due_date||'9999').localeCompare(String(b.due_date||'9999'))).slice(0,5);
  const bankPoints = bankHistory.filter((m)=>m.bank_balance != null).map((m)=>({ label: m.month_key.slice(5), value: Number(m.bank_balance) + Number(m.income || 0) }));

  return `
    <section class="page-head"><div><p class="eyebrow">MONTHLY OVERVIEW</p><h1>Your money this month</h1><p>Opening bank money and salary are combined first, then actual payments are deducted.</p></div><button class="button primary" data-action="add-by-category">+ Add</button></section>

    ${monthSaveCard(month, model)}

    <section class="primary-kpi-grid">
      <article class="kpi-card tone-income"><span>Total Money This Month</span><strong>${money(model.totalMoneyThisMonth)}</strong><small>${money(model.openingBankBalance)} opening bank + ${money(model.salaryReceived)} salary</small></article>
      <article class="kpi-card tone-paid"><span>Paid This Month</span><strong>${money(model.paidThisMonth)}</strong><small>Actual recorded cash out</small></article>
      <article class="kpi-card tone-bank"><span>Available Now</span><strong>${money(model.availableNow)}</strong><small>${money(model.totalMoneyThisMonth)} total − ${money(model.paidThisMonth)} paid</small></article>
      <article class="kpi-card tone-pending"><span>Still Left to Pay</span><strong>${money(model.stillLeftToPay)}</strong><small>Planned expenses + chosen debt targets</small><button class="text-button kpi-action" data-view="payments">View details</button></article>
    </section>

    <section class="secondary-balance-grid">
      <article class="balance-card"><span>Opening Bank Balance</span><strong>${money(model.openingBankBalance)}</strong><button class="text-button" data-action="set-bank-balance">Update</button></article>
      <article class="balance-card"><span>Salary Received</span><strong>${money(model.salaryReceived)}</strong><button class="text-button" data-action="set-income">Edit</button></article>
      <article class="balance-card"><span>Expected After Bills</span><strong>${money(model.expectedAfterBills)}</strong></article>
    </section>

    <section class="secondary-balance-grid">
      <article class="balance-card"><span>Loans Left</span><strong>${money(model.loansLeft)}</strong></article>
      <article class="balance-card"><span>Credits Left</span><strong>${money(model.creditsLeft)}</strong></article>
      <article class="balance-card"><span>Money Owed to Me</span><strong>${money(model.moneyOwedToMe)}</strong></article>
    </section>

    ${guidancePanel(guidance)}

    <section class="dashboard-grid charts-grid">
      <article class="panel chart-panel"><div class="panel-head"><div><h2>Paid vs left</h2><p>Total available money, paid amount, and what is still waiting.</p></div></div>${renderCompositionDonut({ paid: model.paidThisMonth, stillToPay: model.stillLeftToPay, safeToSave: Math.max(0, model.expectedAfterBills) })}</article>
      <article class="panel chart-panel"><div class="panel-head"><div><h2>Cash movement</h2><p>Salary income, cash out, and remaining plans.</p></div></div>${renderMoneyFlowChart({ income: summary.cashIn, paid: summary.cashOut, stillToPay: summary.stillToPay, safeToSave: model.expectedAfterBills })}</article>
    </section>

    <section class="dashboard-grid bank-chart-grid"><article class="panel chart-panel"><div class="panel-head"><div><h2>Starting money trend</h2><p>Opening bank balance + salary for each month.</p></div><button class="text-button" data-action="set-bank-balance">Update opening bank</button></div>${bankPoints.length ? renderTrendLine(bankPoints,{label:'Starting money trend'}) : '<div class="chart-empty">Enter an opening bank balance to start this graph.</div>'}</article></section>

    <section class="dashboard-grid lower-grid"><article class="panel"><div class="panel-head"><div><h2>Upcoming home & other expenses</h2><p>What still needs attention.</p></div><button class="text-button" data-view="payments">View all</button></div><div class="simple-list">${upcoming.length ? upcoming.map((item)=>`<div class="simple-row"><div><b>${item.name_snapshot}</b><span>${shortDate(item.due_date)}</span></div><div class="row-end"><strong>${money(item.remaining)}</strong><span class="status ${item.status.toLowerCase().replace(/\s+/g,'-')}">${item.status}</span></div></div>`).join('') : '<div class="empty-state">Nothing is waiting in Home/Other expenses.</div>'}</div></article>
      <article class="panel"><div class="panel-head"><div><h2>Balance snapshot</h2><p>Keep liabilities and money owed to you separate.</p></div></div><div class="simple-list"><div class="simple-row"><div><b>Loans</b><span>Money you owe</span></div><strong>${money(model.loansLeft)}</strong></div><div class="simple-row"><div><b>Credits</b><span>Money you owe</span></div><strong>${money(model.creditsLeft)}</strong></div><div class="simple-row"><div><b>Money lent</b><span>Money others owe you</span></div><strong>${money(model.moneyOwedToMe)}</strong></div></div></article></section>`;
}
