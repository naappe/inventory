const round2 = (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;

export function buildDebtGuidance({ debts = [], availableNow = 0, stillToPay = 0, emergencyReserve = 0 } = {}) {
  const open = debts.filter((d) => Number(d.current_balance || 0) > 0 && d.is_active !== false);
  const withApr = open.filter((d) => Number(d.apr || 0) > 0);
  const ranked = [...open].sort((a,b) => {
    if (withApr.length) return Number(b.apr || 0) - Number(a.apr || 0) || Number(a.current_balance || 0) - Number(b.current_balance || 0);
    return Number(a.current_balance || 0) - Number(b.current_balance || 0) || String(a.name || '').localeCompare(String(b.name || ''));
  });
  const focusDebt = ranked[0] || null;
  const nextDebt = ranked[1] || null;
  const afterPlans = Math.max(0, round2(Number(availableNow || 0) - Number(stillToPay || 0)));
  const discretionary = Math.max(0, round2(afterPlans - Number(emergencyReserve || 0)));
  const suggestedExtraPayment = focusDebt ? Math.min(round2(focusDebt.current_balance), discretionary) : 0;
  const safeToSave = discretionary;
  const projectedFocusBalance = focusDebt ? Math.max(0, round2(Number(focusDebt.current_balance || 0) - suggestedExtraPayment)) : 0;
  const reason = !focusDebt ? 'No active loan or credit remains.'
    : withApr.length ? `Highest APR at ${Number(focusDebt.apr).toFixed(2)}%, so extra payment here reduces interest cost first.`
    : 'No APR entered, so the smallest remaining balance is the quickest account to clear.';
  return {
    focusDebt,
    nextDebt,
    reason,
    safeToSave,
    suggestedExtraPayment,
    projectedFocusBalance,
    emergencyReserve:round2(emergencyReserve),
    cashFreedAfterPayoff:round2(focusDebt?.monthly_plan || 0),
  };
}
