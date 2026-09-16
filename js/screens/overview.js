import { calculateMonthSummary, itemPaymentTotal, paymentStatus } from '../money-calculations.js';
import { buildDashboardModel } from '../money-dashboard-model.js';
import { renderMoneyFlowChart, renderCompositionDonut, renderTrendLine } from '../money-charts.js';

const money = (n) => `MVR ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shortDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : 'No due date';

export function renderOverview(bundle) {
  const { month, monthItems = [], payments = [], debts = [], receivables = [], receivableTransactions = [], bankHistory = [] } = bundle;
  const summary = calculateMonthSummary({ income: month.income, monthItems, payments, debts, receivables, receivableTransactions });
  const model = buildDashboardModel({ month, summary });
  const upcoming = monthItems.map((item) => {
    const paid = itemPaymentTotal(item.id, payments);
    return { ...item, paid, remaining: Math.max(0, Number(item.planned_amount || 0) - paid), status: paymentStatus(item.planned_amount, paid) };
  }).filter((item) => item.remaining > 0).sort((a,b)=>String(a.due_date||'9999').localeCompare(String(b.due_date||'9999'))).slice(0,5);
  const bankPoints = bankHistory.filter((m)=>m.bank_balance != null).map((m)=>({ label: m.month_key.slice(5), value: Number(m.bank_balance) }));

  return `
    <section class="page-head"><div><p class="eyebrow">MONTHLY OVERVIEW</p><h1>Your money this month</h1><p>Salary, what you paid, what is still left, and your real bank balance.</p></div><button class="button primary" data-action="add-by-category">+ Add</button></section>

    <section class="primary-kpi-grid">
      <article class="kpi-card tone-income"><span>Salary Received</span><strong>${money(model.salaryReceived)}</strong><button class="text-button kpi-action" data-action="set-income">Edit salary</button></article>
      <article class="kpi-card tone-paid"><span>Paid This Month</span><strong>${money(model.paidThisMonth)}</strong><small>Actual recorded cash out</small></article>
      <article class="kpi-card tone-pending"><span>Still Left to Pay</span><strong>${money(model.stillLeftToPay)}</strong><small>Planned expenses + chosen debt targets</small></article>
      <article class="kpi-card tone-bank"><span>Current Bank Balance</span><strong>${model.bankBalance == null ? 'Not entered' : money(model.bankBalance)}</strong><button class="text-button kpi-action" data-action="set-bank-balance">${model.bankBalance == null ? 'Enter balance' : 'Update balance'}</button></article>
    </section>

    <section class="secondary-balance-grid">
      <article class="balance-card"><span>Loans Left</span><strong>${money(model.loansLeft)}</strong></article>
      <article class="balance-card"><span>Credits Left</span><strong>${money(model.creditsLeft)}</strong></article>
      <article class="balance-card"><span>Money Owed to Me</span><strong>${money(model.moneyOwedToMe)}</strong></article>
    </section>

    <section class="dashboard-grid charts-grid">
      <article class="panel chart-panel"><div class="panel-head"><div><h2>Paid vs left</h2><p>Salary, paid amount, and what is still waiting.</p></div></div>${renderCompositionDonut({ paid: model.paidThisMonth, stillToPay: model.stillLeftToPay, safeToSave: Math.max(0, summary.safeToSave) })}</article>
      <article class="panel chart-panel"><div class="panel-head"><div><h2>Cash movement</h2><p>Cash in, cash out, and remaining plans.</p></div></div>${renderMoneyFlowChart({ income: summary.cashIn, paid: summary.cashOut, stillToPay: summary.stillToPay, safeToSave: summary.safeToSave })}</article>
    </section>

    <section class="dashboard-grid bank-chart-grid"><article class="panel chart-panel"><div class="panel-head"><div><h2>Bank balance trend</h2><p>Your manually entered month-end/current bank balances.</p></div><button class="text-button" data-action="set-bank-balance">Update</button></div>${bankPoints.length ? renderTrendLine(bankPoints,{label:'Bank balance trend'}) : '<div class="chart-empty">Enter your current bank balance to start this graph.</div>'}</article></section>

    <section class="dashboard-grid lower-grid"><article class="panel"><div class="panel-head"><div><h2>Upcoming home & other expenses</h2><p>What still needs attention.</p></div><button class="text-button" data-view="payments">View all</button></div><div class="simple-list">${upcoming.length ? upcoming.map((item)=>`<div class="simple-row"><div><b>${item.name_snapshot}</b><span>${shortDate(item.due_date)}</span></div><div class="row-end"><strong>${money(item.remaining)}</strong><span class="status ${item.status.toLowerCase().replace(/\s+/g,'-')}">${item.status}</span></div></div>`).join('') : '<div class="empty-state">Nothing is waiting in Home/Other expenses.</div>'}</div></article>
      <article class="panel"><div class="panel-head"><div><h2>Balance snapshot</h2><p>Keep liabilities and money owed to you separate.</p></div></div><div class="simple-list"><div class="simple-row"><div><b>Loans</b><span>Money you owe</span></div><strong>${money(model.loansLeft)}</strong></div><div class="simple-row"><div><b>Credits</b><span>Money you owe</span></div><strong>${money(model.creditsLeft)}</strong></div><div class="simple-row"><div><b>Money lent</b><span>Money others owe you</span></div><strong>${money(model.moneyOwedToMe)}</strong></div></div></article></section>`;
}
