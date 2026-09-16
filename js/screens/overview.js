import { calculateMonthSummary, chooseFocusDebt, itemPaymentTotal, paymentStatus, monthsRemaining } from '../money-calculations.js';
import { renderMoneyFlowChart, renderCompositionDonut } from '../money-charts.js';

const money = (n) => `MVR ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shortDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : 'No due date';

export function renderOverview(bundle) {
  const { month, monthItems = [], payments = [], debts = [] } = bundle;
  const summary = calculateMonthSummary({ income: month.income, monthItems, payments, debts });
  const focus = chooseFocusDebt(debts);
  const upcoming = monthItems.map((item) => {
    const paid = itemPaymentTotal(item.id, payments);
    return { ...item, paid, remaining: Math.max(0, Number(item.planned_amount || 0) - paid), status: paymentStatus(item.planned_amount, paid) };
  }).filter((item) => item.remaining > 0).sort((a, b) => String(a.due_date || '9999').localeCompare(String(b.due_date || '9999'))).slice(0, 5);
  const activeDebts = debts.filter((d) => Number(d.current_balance || 0) > 0).slice(0, 4);

  return `
    <section class="page-head">
      <div><p class="eyebrow">MONTHLY OVERVIEW</p><h1>Good morning.</h1><p>Here is what your money looks like for this month.</p></div>
      <button class="button primary" data-action="quick-add">+ Add</button>
    </section>

    <section class="kpi-grid">
      <article class="kpi-card tone-income"><span>Income</span><strong>${money(summary.income)}</strong></article>
      <article class="kpi-card tone-paid"><span>Paid this month</span><strong>${money(summary.paid)}</strong><small>${summary.income ? Math.round(summary.paid / summary.income * 100) : 0}% of income</small></article>
      <article class="kpi-card tone-pending"><span>Still to pay</span><strong>${money(summary.stillToPay)}</strong><small>Reserved for planned payments</small></article>
      <article class="kpi-card tone-saving"><span>Safe to save</span><strong>${money(summary.safeToSave)}</strong><small>After remaining plans</small></article>
      <article class="kpi-card tone-debt"><span>Total debt left</span><strong>${money(summary.totalDebt)}</strong><small>Loans + credit</small></article>
    </section>

    <section class="dashboard-grid charts-grid">
      <article class="panel chart-panel"><div class="panel-head"><div><h2>Monthly money flow</h2><p>Income, payments and what is safe to save.</p></div></div>${renderMoneyFlowChart(summary)}</article>
      <article class="panel chart-panel"><div class="panel-head"><div><h2>Your money this month</h2><p>A simple view of where the income stands.</p></div></div>${renderCompositionDonut(summary)}</article>
    </section>

    <section class="dashboard-grid lower-grid">
      <article class="panel">
        <div class="panel-head"><div><h2>Upcoming payments</h2><p>What still needs attention.</p></div><button class="text-button" data-view="payments">View all</button></div>
        <div class="simple-list">${upcoming.length ? upcoming.map((item) => `<div class="simple-row"><div><b>${item.name_snapshot}</b><span>${shortDate(item.due_date)}</span></div><div class="row-end"><strong>${money(item.remaining)}</strong><span class="status ${item.status.toLowerCase().replace(/\s+/g, '-')}">${item.status}</span></div></div>`).join('') : '<div class="empty-state">Nothing is waiting. Your plan is clear.</div>'}</div>
      </article>

      <article class="panel">
        <div class="panel-head"><div><h2>Your debts</h2><p>Remaining balances.</p></div><button class="text-button" data-view="debts">View all</button></div>
        <div class="simple-list">${activeDebts.length ? activeDebts.map((debt) => {
          const original = Math.max(Number(debt.opening_balance || 0), Number(debt.current_balance || 0));
          const progress = original ? Math.max(0, Math.min(100, ((original - Number(debt.current_balance || 0)) / original) * 100)) : 100;
          return `<div class="debt-mini"><div><b>${debt.name}</b><span>${debt.debt_type === 'loan' ? 'Loan' : 'Credit'}</span></div><strong>${money(debt.current_balance)}</strong><div class="mini-progress"><i style="width:${progress}%"></i></div></div>`;
        }).join('') : '<div class="empty-state">No debt balances entered.</div>'}</div>
        ${focus ? `<div class="focus-callout"><span>FOCUS DEBT</span><b>${focus.name}</b><p>Finish this first. It can free ${money(focus.monthly_plan)} per month${monthsRemaining(focus.current_balance, focus.monthly_plan) ? ` in about ${monthsRemaining(focus.current_balance, focus.monthly_plan)} months at the current plan` : ''}.</p></div>` : ''}
      </article>
    </section>`;
}
