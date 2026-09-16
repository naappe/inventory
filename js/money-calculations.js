const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const positive = (value) => Math.max(0, round2(value));

export function calculateDebtPreview(currentBalance, enteredAmount) {
  const balance = positive(currentBalance);
  const requested = positive(enteredAmount);
  const effectiveAmount = Math.min(balance, requested);
  return {
    effectiveAmount: round2(effectiveAmount),
    afterPayment: round2(Math.max(0, balance - effectiveAmount)),
  };
}

export function monthsRemaining(balance, monthlyPlan) {
  const left = positive(balance);
  const plan = positive(monthlyPlan);
  if (left === 0) return 0;
  if (plan === 0) return null;
  return Math.ceil(left / plan);
}

export function chooseFocusDebt(debts = []) {
  const open = debts.filter((d) => positive(d.current_balance) > 0 && d.is_active !== false);
  if (!open.length) return null;
  const withApr = open.filter((d) => positive(d.apr) > 0);
  if (withApr.length) {
    return [...withApr].sort((a, b) => positive(b.apr) - positive(a.apr) || positive(a.current_balance) - positive(b.current_balance))[0];
  }
  return [...open].sort((a, b) => positive(a.current_balance) - positive(b.current_balance) || String(a.name || '').localeCompare(String(b.name || '')))[0];
}

export function itemPaymentTotal(itemId, payments = []) {
  return round2(payments
    .filter((p) => !p.reversed_at && p.payment_type === 'expense' && p.month_item_id === itemId)
    .reduce((sum, p) => sum + Number(p.amount || 0), 0));
}

export function debtPaymentTotal(debtId, payments = []) {
  return round2(payments
    .filter((p) => !p.reversed_at && p.payment_type === 'debt' && p.debt_id === debtId)
    .reduce((sum, p) => sum + Number(p.amount || 0), 0));
}

export function paymentStatus(planned, paid) {
  const plan = positive(planned);
  const actual = positive(paid);
  if (plan === 0) return 'No plan';
  if (actual >= plan) return 'Paid';
  if (actual > 0) return 'Partial';
  return 'Waiting';
}

export function calculateMonthSummary({
  income = 0,
  monthItems = [],
  payments = [],
  debts = [],
  receivables = [],
  receivableTransactions = [],
} = {}) {
  const activePayments = payments.filter((p) => !p.reversed_at);
  const activeReceivableTransactions = receivableTransactions.filter((t) => !t.reversed_at && t.transaction_type !== 'reversal');

  const ordinaryPaid = round2(activePayments
    .filter((p) => p.payment_type === 'expense')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0));
  const liabilityPaid = round2(activePayments
    .filter((p) => p.payment_type === 'debt')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0));
  const moneyLent = round2(activeReceivableTransactions
    .filter((t) => t.transaction_type === 'lend')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0));
  const receivableRepayments = round2(activeReceivableTransactions
    .filter((t) => t.transaction_type === 'repayment')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0));

  const cashIn = round2(Number(income || 0) + receivableRepayments);
  const cashOut = round2(ordinaryPaid + liabilityPaid + moneyLent);
  const paid = cashOut;
  const availableNow = round2(cashIn - cashOut);

  const expenseItems = monthItems.filter((item) => !item.debt_id);
  const expensePlan = round2(expenseItems.reduce((sum, item) => sum + positive(item.planned_amount), 0));
  const expenseStillToPay = round2(expenseItems.reduce((sum, item) => {
    const itemPaid = itemPaymentTotal(item.id, activePayments);
    return sum + Math.max(0, positive(item.planned_amount) - itemPaid);
  }, 0));

  let debtPlan = 0;
  let debtStillToPay = 0;
  let totalDebt = 0;
  let loansLeft = 0;
  let creditLeft = 0;

  for (const debt of debts) {
    const current = positive(debt.current_balance);
    const debtPaid = debtPaymentTotal(debt.id, activePayments);
    const openingForMonth = round2(current + debtPaid);
    const plannedTarget = Math.min(positive(debt.monthly_plan), openingForMonth);
    debtPlan += plannedTarget;
    debtStillToPay += Math.max(0, plannedTarget - debtPaid);
    totalDebt += current;
    if (debt.debt_type === 'loan') loansLeft += current;
    else if (debt.debt_type === 'credit') creditLeft += current;
  }

  debtPlan = round2(debtPlan);
  debtStillToPay = round2(debtStillToPay);
  totalDebt = round2(totalDebt);
  loansLeft = round2(loansLeft);
  creditLeft = round2(creditLeft);

  const receivablesLeft = round2(receivables
    .filter((r) => r.is_active !== false)
    .reduce((sum, r) => sum + positive(r.current_balance), 0));
  const stillToPay = round2(expenseStillToPay + debtStillToPay);
  const safeToSave = round2(Math.max(0, availableNow - stillToPay));
  const totalPlanned = round2(expensePlan + debtPlan);
  const projectedAfterPlan = round2(cashIn - totalPlanned - moneyLent);

  return {
    income: round2(income),
    paid,
    cashIn,
    cashOut,
    availableNow,
    ordinaryPaid,
    liabilityPaid,
    moneyLent,
    receivableRepayments,
    receivablesLeft,
    expensePlan,
    debtPlan,
    totalPlanned,
    expenseStillToPay,
    debtStillToPay,
    stillToPay,
    safeToSave,
    projectedAfterPlan,
    totalDebt,
    loansLeft,
    creditLeft,
  };
}
