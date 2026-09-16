const VALID_BEHAVIORS = new Set(['liability', 'expense', 'receivable']);

export function behaviorForCategory(category) {
  const value = String(category?.behavior_type || 'expense');
  return VALID_BEHAVIORS.has(value) ? value : 'expense';
}

export function formModeForBehavior(behavior) {
  if (behavior === 'liability') return 'liability-payment';
  if (behavior === 'receivable') return 'receivable';
  return 'expense-payment';
}

export function deletionPolicyForExpenseItem({ paymentCount = 0 } = {}) {
  const hasHistory = Number(paymentCount || 0) > 0;
  return {
    deactivateMaster: true,
    removeCurrentSnapshot: !hasHistory,
    preserveHistory: hasHistory,
  };
}
