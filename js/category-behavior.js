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
