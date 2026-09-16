const n = (value) => Number(value || 0);

export function buildDashboardModel({ month = {}, summary = {} } = {}) {
  return {
    salaryReceived: n(month.income),
    paidThisMonth: n(summary.paid),
    stillLeftToPay: n(summary.stillToPay),
    bankBalance: month.bank_balance == null ? null : Number(month.bank_balance),
    loansLeft: n(summary.loansLeft),
    creditsLeft: n(summary.creditLeft),
    moneyOwedToMe: n(summary.receivablesLeft),
    cashIn: n(summary.cashIn),
    cashOut: n(summary.cashOut),
  };
}
