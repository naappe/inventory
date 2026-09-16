import { supabase } from './supabase-client.js';
import { ALLOWED_EMAIL, FIRST_MONTH } from './config.js';

async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const user = data.user;
  if (!user || String(user.email || '').toLowerCase() !== ALLOWED_EMAIL) throw new Error('Not authorized.');
  return user;
}

function unwrap(result) {
  if (result.error) throw result.error;
  return result.data;
}

const nonNegative = (value) => Math.max(0, Number(value || 0));

export async function bootstrapSeptember() {
  await requireUser();
  const { data, error } = await supabase.rpc('money_bootstrap_september');
  if (error) throw error;
  return data;
}

export async function createMonth(monthKey) {
  await requireUser();
  if (monthKey < FIRST_MONTH) throw new Error('Money Plan starts in September 2026.');
  const { data, error } = await supabase.rpc('money_create_month', { p_month_key: monthKey });
  if (error) throw error;
  return data;
}

export async function listMonths() {
  await requireUser();
  return unwrap(await supabase.from('money_months').select('*').order('month_key')) || [];
}

export async function getMonth(monthKey) {
  await requireUser();
  return unwrap(await supabase.from('money_months').select('*').eq('month_key', monthKey).maybeSingle());
}

export async function setIncome(monthId, income) {
  await requireUser();
  return unwrap(await supabase.from('money_months').update({ income: nonNegative(income) }).eq('id', monthId).select().single());
}

export async function setBankBalance(monthId, value) {
  await requireUser();
  const clean = value === '' || value == null ? null : nonNegative(value);
  return unwrap(await supabase.from('money_months').update({ bank_balance: clean }).eq('id', monthId).select().single());
}

export async function markSetupComplete(monthId) {
  await requireUser();
  return unwrap(await supabase.from('money_months').update({ setup_complete: true }).eq('id', monthId).select().single());
}

export async function listCategories() {
  await requireUser();
  return unwrap(await supabase.from('money_categories').select('*').eq('is_active', true).order('display_order').order('name')) || [];
}

export async function createCategory(name, behavior = 'expense') {
  const user = await requireUser();
  const clean = String(name || '').trim();
  if (!clean) throw new Error('Category name is required.');
  if (!['liability', 'expense', 'receivable'].includes(behavior)) throw new Error('Choose a valid category behavior.');
  const existing = await listCategories();
  const displayOrder = existing.length ? Math.max(...existing.map((x) => Number(x.display_order || 0))) + 1 : 0;
  return unwrap(await supabase.from('money_categories').insert({ user_id: user.id, name: clean, behavior_type: behavior, display_order: displayOrder }).select().single());
}

export async function updateCategoryBehavior(id, behavior) {
  await requireUser();
  if (!['liability', 'expense', 'receivable'].includes(behavior)) throw new Error('Choose a valid category behavior.');
  return unwrap(await supabase.from('money_categories').update({ behavior_type: behavior }).eq('id', id).select().single());
}

export async function listItems({ activeOnly = true } = {}) {
  await requireUser();
  let query = supabase.from('money_items').select('*, category:money_categories(id,name,behavior_type)').order('name');
  if (activeOnly) query = query.eq('is_active', true);
  return unwrap(await query) || [];
}

async function requireExpenseCategory(categoryId) {
  if (!categoryId) return null;
  const row = unwrap(await supabase.from('money_categories').select('id,name,behavior_type').eq('id', categoryId).single());
  if (row.behavior_type !== 'expense') throw new Error('This category is not an expense category.');
  return row;
}

export async function createItem({ name, categoryId, plannedAmount = 0, dueDay = null, recurring = true }) {
  const user = await requireUser();
  const clean = String(name || '').trim();
  if (!clean) throw new Error('Payment name is required.');
  await requireExpenseCategory(categoryId);
  return unwrap(await supabase.from('money_items').insert({
    user_id: user.id,
    name: clean,
    category_id: categoryId || null,
    default_planned_amount: nonNegative(plannedAmount),
    due_day: dueDay ? Math.min(31, Math.max(1, Number(dueDay))) : null,
    is_recurring: Boolean(recurring),
    is_active: true,
  }).select().single());
}

export async function updateItem(id, changes) {
  await requireUser();
  const payload = {};
  if (changes.name != null) payload.name = String(changes.name).trim();
  if (changes.categoryId !== undefined) {
    await requireExpenseCategory(changes.categoryId);
    payload.category_id = changes.categoryId || null;
  }
  if (changes.plannedAmount != null) payload.default_planned_amount = nonNegative(changes.plannedAmount);
  if (changes.dueDay !== undefined) payload.due_day = changes.dueDay ? Math.min(31, Math.max(1, Number(changes.dueDay))) : null;
  if (changes.recurring !== undefined) payload.is_recurring = Boolean(changes.recurring);
  if (changes.active !== undefined) payload.is_active = Boolean(changes.active);
  return unwrap(await supabase.from('money_items').update(payload).eq('id', id).select().single());
}

export async function archiveItemForMonth(itemId, monthItemId) {
  await requireUser();
  await unwrap(await supabase.from('money_items').update({ is_active: false }).eq('id', itemId));

  const snapshot = unwrap(await supabase.from('money_month_items').select('id,month_id,item_id').eq('id', monthItemId).eq('item_id', itemId).maybeSingle());
  if (!snapshot) return { snapshotRemoved: false, historyPreserved: false, removedCount: 0 };

  const currentMonth = unwrap(await supabase.from('money_months').select('month_key').eq('id', snapshot.month_id).single());
  const futureMonths = unwrap(await supabase.from('money_months').select('id').gte('month_key', currentMonth.month_key));
  const monthIds = (futureMonths || []).map((m) => m.id);
  if (!monthIds.length) return { snapshotRemoved: false, historyPreserved: false, removedCount: 0 };

  const snapshots = unwrap(await supabase.from('money_month_items').select('id').eq('item_id', itemId).in('month_id', monthIds)) || [];
  const snapshotIds = snapshots.map((s) => s.id);
  if (!snapshotIds.length) return { snapshotRemoved: false, historyPreserved: false, removedCount: 0 };

  const paymentRows = unwrap(await supabase.from('money_payments').select('month_item_id').in('month_item_id', snapshotIds)) || [];
  const protectedIds = new Set(paymentRows.map((p) => p.month_item_id));
  const removableIds = snapshotIds.filter((id) => !protectedIds.has(id));
  if (removableIds.length) unwrap(await supabase.from('money_month_items').delete().in('id', removableIds));

  return {
    snapshotRemoved: removableIds.includes(monthItemId),
    historyPreserved: protectedIds.has(monthItemId),
    removedCount: removableIds.length,
  };
}

export async function listDebts({ includeCompleted = true } = {}) {
  await requireUser();
  let query = supabase.from('money_debts').select('*').order('is_active', { ascending: false }).order('current_balance');
  if (!includeCompleted) query = query.eq('is_active', true);
  return unwrap(await query) || [];
}

export async function listDebtsAsOf(monthKey) {
  const [debts, months] = await Promise.all([listDebts({ includeCompleted: true }), listMonths()]);
  const monthIds = months.filter((m) => m.month_key <= monthKey).map((m) => m.id);
  let debtPayments = [];
  if (monthIds.length) debtPayments = unwrap(await supabase.from('money_payments').select('debt_id,amount,reversed_at,month_id').eq('payment_type', 'debt').in('month_id', monthIds)) || [];
  return debts
    .filter((debt) => String(debt.start_month_key || FIRST_MONTH) <= monthKey)
    .map((debt) => {
      const paidThroughMonth = debtPayments.filter((p) => !p.reversed_at && p.debt_id === debt.id).reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const history = debt.monthly_plan_history && typeof debt.monthly_plan_history === 'object' ? debt.monthly_plan_history : {};
      const balance = Math.max(0, Number(debt.opening_balance || 0) - paidThroughMonth);
      return { ...debt, current_balance: Number(balance.toFixed(2)), monthly_plan: Number(history[monthKey] ?? debt.monthly_plan ?? 0), is_active: balance > 0 };
    });
}

export async function createDebt({ name, type, balance, monthlyPlan = 0, apr = null, focusOrder = null, startMonthKey = FIRST_MONTH }) {
  const user = await requireUser();
  const clean = String(name || '').trim();
  const opening = nonNegative(balance);
  const plan = nonNegative(monthlyPlan);
  if (!clean) throw new Error('Debt name is required.');
  if (!['loan', 'credit'].includes(type)) throw new Error('Choose loan or credit.');
  if (startMonthKey < FIRST_MONTH) throw new Error('Debt tracking starts in September 2026 or later.');
  return unwrap(await supabase.from('money_debts').insert({
    user_id: user.id,
    name: clean,
    debt_type: type,
    opening_balance: opening,
    current_balance: opening,
    monthly_plan: plan,
    monthly_plan_history: { [startMonthKey]: plan },
    start_month_key: startMonthKey,
    apr: apr === '' || apr == null ? null : nonNegative(apr),
    focus_order: focusOrder == null ? null : Number(focusOrder),
    is_active: opening > 0,
  }).select().single());
}

export async function updateDebt(id, changes, monthKey = FIRST_MONTH) {
  await requireUser();
  const payload = {};
  if (changes.name != null) payload.name = String(changes.name).trim();
  if (changes.type != null) payload.debt_type = changes.type;
  if (changes.monthlyPlan != null) {
    const plan = nonNegative(changes.monthlyPlan);
    const current = unwrap(await supabase.from('money_debts').select('monthly_plan_history').eq('id', id).single());
    payload.monthly_plan = plan;
    payload.monthly_plan_history = { ...(current?.monthly_plan_history || {}), [monthKey]: plan };
  }
  if (changes.apr !== undefined) payload.apr = changes.apr === '' || changes.apr == null ? null : nonNegative(changes.apr);
  if (changes.focusOrder !== undefined) payload.focus_order = changes.focusOrder == null ? null : Number(changes.focusOrder);
  if (changes.active !== undefined) payload.is_active = Boolean(changes.active);
  return unwrap(await supabase.from('money_debts').update(payload).eq('id', id).select().single());
}

export async function listReceivables({ includeCompleted = true } = {}) {
  await requireUser();
  let query = supabase.from('money_receivables').select('*').order('is_active', { ascending: false }).order('current_balance');
  if (!includeCompleted) query = query.eq('is_active', true);
  return unwrap(await query) || [];
}

export async function listReceivablesAsOf(monthKey) {
  const [receivables, months] = await Promise.all([listReceivables({ includeCompleted: true }), listMonths()]);
  const monthIds = months.filter((m) => m.month_key <= monthKey).map((m) => m.id);
  let txs = [];
  if (monthIds.length) txs = unwrap(await supabase.from('money_receivable_transactions').select('*').in('month_id', monthIds)) || [];
  return receivables
    .filter((r) => String(r.start_month_key || FIRST_MONTH) <= monthKey)
    .map((r) => {
      const lend = txs.find((t) => t.receivable_id === r.id && t.transaction_type === 'lend');
      const reversedLend = lend?.reversed_at;
      const repaid = txs.filter((t) => t.receivable_id === r.id && t.transaction_type === 'repayment' && !t.reversed_at).reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const balance = reversedLend ? 0 : Math.max(0, Number(r.opening_balance || 0) - repaid);
      return { ...r, current_balance: Number(balance.toFixed(2)), is_active: balance > 0 };
    });
}

export async function createReceivable({ name, amount, date, monthId, expectedRepaymentDate = null, remarks = '' }) {
  await requireUser();
  if (Number(amount) <= 0) throw new Error('Amount must be greater than zero.');
  const { data, error } = await supabase.rpc('money_create_receivable', {
    p_month_id: monthId,
    p_name: String(name || '').trim(),
    p_amount: Number(amount),
    p_transaction_date: date,
    p_expected_repayment_date: expectedRepaymentDate || null,
    p_remarks: remarks || null,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function recordReceivableRepayment({ receivableId, monthId, amount, date, remarks = '' }) {
  await requireUser();
  if (Number(amount) <= 0) throw new Error('Amount must be greater than zero.');
  const { data, error } = await supabase.rpc('money_record_receivable_repayment', {
    p_receivable_id: receivableId,
    p_month_id: monthId,
    p_amount: Number(amount),
    p_transaction_date: date,
    p_remarks: remarks || null,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function reverseReceivableTransaction(transactionId, reason = 'Correction') {
  await requireUser();
  const { data, error } = await supabase.rpc('money_reverse_receivable_transaction', { p_transaction_id: transactionId, p_reason: reason });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function getMonthBundle(monthKey) {
  let month = await getMonth(monthKey);
  if (!month) {
    await createMonth(monthKey);
    month = await getMonth(monthKey);
  }
  const [monthItems, payments, debts, categories, receivables, receivableTransactions] = await Promise.all([
    unwrap(await supabase.from('money_month_items').select('*').eq('month_id', month.id).order('due_date', { ascending: true, nullsFirst: false }).order('name_snapshot')),
    unwrap(await supabase.from('money_payments').select('*').eq('month_id', month.id).order('payment_date', { ascending: false }).order('created_at', { ascending: false })),
    listDebtsAsOf(monthKey),
    listCategories(),
    listReceivablesAsOf(monthKey),
    unwrap(await supabase.from('money_receivable_transactions').select('*').eq('month_id', month.id).order('transaction_date', { ascending: false }).order('created_at', { ascending: false })),
  ]);
  return { month, monthItems: monthItems || [], payments: payments || [], debts, categories, receivables, receivableTransactions: receivableTransactions || [] };
}

export async function recordPayment({ monthId, type, amount, date, monthItemId = null, debtId = null, note = '' }) {
  await requireUser();
  if (Number(amount) <= 0) throw new Error('Amount must be greater than zero.');
  const { data, error } = await supabase.rpc('money_record_payment', {
    p_month_id: monthId,
    p_payment_type: type,
    p_amount: Number(amount),
    p_payment_date: date,
    p_month_item_id: monthItemId,
    p_debt_id: debtId,
    p_note: note || null,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function reversePayment(paymentId, reason = 'Correction') {
  await requireUser();
  const { data, error } = await supabase.rpc('money_reverse_payment', { p_payment_id: paymentId, p_reason: reason });
  if (error) throw error;
  return data;
}

export async function historyData() {
  const months = await listMonths();
  const [debts, receivables] = await Promise.all([listDebts({ includeCompleted: true }), listReceivables({ includeCompleted: true })]);
  const bundles = await Promise.all(months.map(async (month) => {
    const [monthItems, payments, receivableTransactions] = await Promise.all([
      unwrap(await supabase.from('money_month_items').select('*').eq('month_id', month.id)),
      unwrap(await supabase.from('money_payments').select('*').eq('month_id', month.id)),
      unwrap(await supabase.from('money_receivable_transactions').select('*').eq('month_id', month.id)),
    ]);
    return { month, monthItems: monthItems || [], payments: payments || [], receivableTransactions: receivableTransactions || [] };
  }));
  return { months, debts, receivables, bundles };
}
