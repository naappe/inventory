const n = (value) => Number(value || 0);
const round2 = (value) => Math.round((n(value) + Number.EPSILON) * 100) / 100;

export function buildDashboardModel({ month = {}, summary = {} } = {}) {
  const openingBankBalance = month.bank_balance == null ? 0 : round2(month.bank_balance);
  const salaryReceived = round2(month.income);
  const paidThisMonth = round2(summary.cashOut ?? summary.paid);
  const stillLeftToPay = round2(summary.stillToPay);
  const totalMoneyThisMonth = round2(openingBankBalance + salaryReceived);
  const availableNow = round2(totalMoneyThisMonth - paidThisMonth);
  const expectedAfterBills = round2(availableNow - stillLeftToPay);

  return {
    openingBankBalance,
    salaryReceived,
    totalMoneyThisMonth,
    paidThisMonth,
    stillLeftToPay,
    bankBalance: availableNow,
    availableNow,
    expectedAfterBills,
    loansLeft: round2(summary.loansLeft),
    creditsLeft: round2(summary.creditLeft),
    moneyOwedToMe: round2(summary.receivablesLeft),
    cashIn: round2(summary.cashIn),
    cashOut: round2(summary.cashOut),
  };
}
