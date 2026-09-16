export function applyLocalPaymentReversal(bundle, paymentId, { reversedAt = new Date().toISOString(), debtBalance = null } = {}) {
  const payments = Array.isArray(bundle?.payments) ? bundle.payments : [];
  const payment = payments.find((row) => row.id === paymentId);
  if (!payment) throw new Error('Payment not found in the current month.');

  const nextPayments = payments.map((row) => row.id === paymentId
    ? { ...row, reversed_at: reversedAt, reversal_reason: row.reversal_reason || 'Undo monthly payment' }
    : row);

  let nextDebts = Array.isArray(bundle?.debts) ? bundle.debts : [];
  if (payment.payment_type === 'debt' && payment.debt_id && debtBalance != null) {
    nextDebts = nextDebts.map((debt) => debt.id === payment.debt_id
      ? { ...debt, current_balance: Number(debtBalance), is_active: Number(debtBalance) > 0 }
      : debt);
  }

  return { ...bundle, payments: nextPayments, debts: nextDebts };
}
