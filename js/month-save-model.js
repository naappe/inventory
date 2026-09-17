const round2 = (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;
const monthName = (key) => new Date(`${key}-01T00:00:00`).toLocaleDateString('en-US',{month:'long'});

export function buildMonthSaveState(month = {}) {
  const saved = Boolean(month.saved_at);
  const dirty = saved && Boolean(month.dirty_since_save);
  const name = monthName(month.month_key || '2026-09');
  return {
    status: !saved ? 'not-saved' : dirty ? 'dirty' : 'saved',
    label: !saved ? 'Not Saved' : dirty ? 'Changes not saved' : 'Saved',
    buttonLabel: !saved ? `Save ${name}` : dirty ? `Save ${name} Again` : null,
    savedAt: month.saved_at || null,
    revision: Number(month.saved_revision || 0),
    isDirty: dirty,
  };
}

export function buildMonthSnapshot({ month = {}, dashboard = {}, debtReduced = 0, safeToSave = 0, savedAt = new Date().toISOString() } = {}) {
  return {
    monthKey: month.month_key,
    openingBankBalance: round2(dashboard.openingBankBalance),
    salaryReceived: round2(dashboard.salaryReceived),
    totalMoneyThisMonth: round2(dashboard.totalMoneyThisMonth),
    spentThisMonth: round2(dashboard.paidThisMonth),
    stillToPay: round2(dashboard.stillLeftToPay),
    availableNow: round2(dashboard.availableNow),
    expectedMonthEnd: round2(dashboard.expectedAfterBills),
    loansRemaining: round2(dashboard.loansLeft),
    creditsRemaining: round2(dashboard.creditsLeft),
    moneyOwedToMe: round2(dashboard.moneyOwedToMe),
    safeToSave: round2(safeToSave),
    debtReduced: round2(debtReduced),
    savedAt,
  };
}
