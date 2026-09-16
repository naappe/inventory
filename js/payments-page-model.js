import { calculateMonthSummary, debtPaymentTotal, itemPaymentTotal, paymentStatus } from './money-calculations.js';

const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

function activePaymentIds(payments, predicate) {
  return payments.filter((payment) => !payment.reversed_at && predicate(payment)).map((payment) => payment.id);
}

function liabilityRows(debts, payments, type) {
  return debts
    .filter((debt) => debt.debt_type === type)
    .map((debt) => {
      const paidThisMonth = debtPaymentTotal(debt.id, payments);
      const balanceLeft = round2(debt.current_balance);
      const openingBalance = round2(balanceLeft + paidThisMonth);
      const target = Math.max(0, Number(debt.monthly_plan || 0));
      const targetRemaining = Math.max(0, round2(target - paidThisMonth));
      const paymentIds = activePaymentIds(payments, (payment) => payment.payment_type === 'debt' && payment.debt_id === debt.id);
      return {
        ...debt,
        openingBalance,
        paidThisMonth,
        balanceLeft,
        target,
        targetRemaining,
        activePaymentIds: paymentIds,
        canUndoPayment: paymentIds.length > 0,
      };
    });
}

function buildTips({ salary, spent, bankBalance, stillToPay, loans }) {
  const tips = [];
  const spendRate = salary > 0 ? Math.round((spent / salary) * 100) : 0;
  const safeToSpend = Math.max(0, round2(bankBalance - stillToPay));
  const smallestLoan = loans.filter((loan) => loan.balanceLeft > 0).sort((a, b) => a.balanceLeft - b.balanceLeft)[0];

  if (stillToPay <= 0) {
    tips.push({ title: 'Monthly plans covered', text: 'All currently planned monthly expenses and payment targets are covered.' });
  } else {
    tips.push({ title: 'Protect upcoming payments', text: `Keep at least MVR ${round2(stillToPay).toLocaleString('en-US', { minimumFractionDigits: 2 })} aside for items still to pay.` });
  }

  if (salary > 0) {
    tips.push({ title: 'Salary usage', text: `${spendRate}% of this month’s salary has been used in recorded spending.` });
  }

  tips.push({ title: 'Safe to spend', text: `After reserving what is still due, about MVR ${safeToSpend.toLocaleString('en-US', { minimumFractionDigits: 2 })} remains available.` });

  if (smallestLoan) {
    tips.push({ title: 'Loan focus', text: `${smallestLoan.name} is currently the smallest loan balance at MVR ${round2(smallestLoan.balanceLeft).toLocaleString('en-US', { minimumFractionDigits: 2 })}.` });
  }

  return tips.slice(0, 4);
}

export function buildPaymentsPageModel(bundle = {}) {
  const {
    month = {},
    monthItems = [],
    payments = [],
    debts = [],
    receivables = [],
    receivableTransactions = [],
  } = bundle;

  const summary = calculateMonthSummary({
    income: month.income,
    monthItems,
    payments,
    debts,
    receivables,
    receivableTransactions,
  });

  const expenses = monthItems.map((item) => {
    const paid = itemPaymentTotal(item.id, payments);
    const planned = Math.max(0, Number(item.planned_amount || 0));
    const remaining = Math.max(0, round2(planned - paid));
    const paymentIds = activePaymentIds(payments, (payment) => payment.payment_type === 'expense' && payment.month_item_id === item.id);
    return {
      ...item,
      planned,
      paid,
      remaining,
      status: paymentStatus(planned, paid),
      activePaymentIds: paymentIds,
      canUndoPayment: paymentIds.length > 0,
    };
  });

  const salaryGot = round2(month.income);
  const spentThisMonth = round2(summary.cashOut);
  const openingBankBalance = month.bank_balance == null ? 0 : round2(month.bank_balance);
  const bankBalance = round2(openingBankBalance + salaryGot - spentThisMonth);
  const loans = liabilityRows(debts, payments, 'loan');
  const credits = liabilityRows(debts, payments, 'credit');
  const stillToPay = round2(summary.stillToPay);
  const expectedMonthEnd = round2(bankBalance - stillToPay);

  return {
    salaryGot,
    openingBankBalance,
    bankBalance,
    spentThisMonth,
    expectedMonthEnd,
    safeToSpend: Math.max(0, expectedMonthEnd),
    stillToPay,
    loansLeft: round2(summary.loansLeft),
    creditsLeft: round2(summary.creditLeft),
    expenses,
    loans,
    credits,
    tips: buildTips({ salary: salaryGot, spent: spentThisMonth, bankBalance, stillToPay, loans }),
    recentPayments: payments.filter((p) => !p.reversed_at).slice(0, 12),
  };
}
