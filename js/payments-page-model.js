import { calculateMonthSummary, debtPaymentTotal, itemPaymentTotal, paymentStatus } from './money-calculations.js';

const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

function liabilityRows(debts, payments, type) {
  return debts
    .filter((debt) => debt.debt_type === type)
    .map((debt) => {
      const paidThisMonth = debtPaymentTotal(debt.id, payments);
      const balanceLeft = round2(debt.current_balance);
      const openingBalance = round2(balanceLeft + paidThisMonth);
      const target = Math.max(0, Number(debt.monthly_plan || 0));
      const targetRemaining = Math.max(0, round2(target - paidThisMonth));
      return {
        ...debt,
        openingBalance,
        paidThisMonth,
        balanceLeft,
        target,
        targetRemaining,
      };
    });
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
    return { ...item, planned, paid, remaining, status: paymentStatus(planned, paid) };
  });

  return {
    salaryGot: round2(month.income),
    bankBalance: month.bank_balance == null ? null : round2(month.bank_balance),
    spentThisMonth: round2(summary.cashOut),
    salaryBalance: round2(summary.cashIn - summary.cashOut),
    stillToPay: round2(summary.stillToPay),
    loansLeft: round2(summary.loansLeft),
    creditsLeft: round2(summary.creditLeft),
    expenses,
    loans: liabilityRows(debts, payments, 'loan'),
    credits: liabilityRows(debts, payments, 'credit'),
    recentPayments: payments.filter((p) => !p.reversed_at).slice(0, 12),
  };
}
