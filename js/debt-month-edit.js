const money2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const positive = (value) => Math.max(0, money2(value));

export function debtMonthEditPreview({ totalAmount = 0, paidBeforeMonth = 0, currentMonthPaid = 0, newMonthPayment = 0 } = {}) {
  const total = positive(totalAmount);
  const before = positive(paidBeforeMonth);
  const oldMonth = positive(currentMonthPaid);
  const requested = positive(newMonthPayment);
  if (total < before) throw new Error('Total amount cannot be below payments already made before this month.');
  const available = Math.max(0, total - before);
  const effective = Math.min(requested, available);
  return {
    totalAmount: total,
    paidBeforeMonth: before,
    currentMonthPaid: oldMonth,
    newMonthPayment: money2(effective),
    remainingBalance: money2(Math.max(0, total - before - effective)),
  };
}
