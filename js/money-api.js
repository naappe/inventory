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
  const value = Math.max(0, Number(income || 0));
  return unwrap(await supabase.from('money_months').update({ income: value }).eq('id', monthId).select().single());
}

export async function markSetupComplete(monthId) {
  await requireUser();
  return unwrap(await supabase.from('money_months').update({ setup_complete: true }).eq('id', monthId).select().single());
}

export async function listCategories() {
  await requireUser();
  return unwrap(await supabase.from('money_categories').select('*').eq('is_active', true).order('display_order').order('name')) || [];
}

export async function createCategory(name) {
  const user = await requireUser();
  const clean = String(name || '').trim();
  if (!clean) throw new Error('Category name is required.');
  const existing = await listCategories();
  const displayOrder = existing.length ? Math.max(...existing.map((x) => Number(x.display_order || 0))) + 1 : 0;
  return unwrap(await supabase.from('money_categories').insert({ user_id: user.id, name: clean, display_order: displayOrder }).select().single());
}

export async function listItems({ activeOnly = true } = {}) {
  await requireUser();
  let query = supabase.from('money_items').select('*, category:money_categories(id,name)').order('name');
  if (activeOnly) query = query.eq('is_active', true);
  return unwrap(await query) || [];
}

export async function createItem({ name, categoryId, plannedAmount = 0, dueDay = null, recurring = true }) {
  const user = await requireUser();
  const clean = String(name || '').trim();
  if (!clean) throw new Error('Payment name is required.');
  const payload = {
    user_id: user.id,
    name: clean,
    category_id: categoryId || null,
    default_planned_amount: Math.max(0, Number(plannedAmount || 0)),
    due_day: dueDay ? Math.min(31, Math.max(1, Number(dueDay))) : null,
    is_recurring: Boolean(recurring),
    is_active: true,
  };
  return unwrap(await supabase.from('money_items').insert(payload).select().single());
}

export async function updateItem(id, changes) {
  await requireUser();
  const payload = {};
  if (changes.name != null) payload.name = String(changes.name).trim();
  if (changes.categoryId !== undefined) payload.category_id = changes.categoryId || null;
  if (changes.plannedAmount != null) payload.default_planned_amount = Math.max(0, Number(changes.plannedAmount || 0));
  if (changes.dueDay !== undefined) payload.due_day = changes.dueDay ? Math.min(31, Math.max(1, Number(changes.dueDay))) : null;
  if (changes.recurring !== undefined) payload.is_recurring = Boolean(changes.recurring);
  if (changes.active !== undefined) payload.is_active = Boolean(changes.active);
  return unwrap(await supabase.from('money_items').update(payload).eq('id', id).select().single());
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
  if (monthIds.length) {
    debtPayments = unwrap(await supabase.from('money_payments').select('debt_id,amount,reversed_at,month_id').eq('payment_type', 'debt').in('month_id', monthIds)) || [];
  }
  return debts
    .filter((debt) => String(debt.start_month_key || FIRST_MONTH) <= monthKey)
    .map((debt) => {
      const paidThroughMonth = debtPayments
        .filter((payment) => !payment.reversed_at && payment.debt_id === debt.id)
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const planHistory = debt.monthly_plan_history && typeof debt.monthly_plan_history === 'object' ? debt.monthly_plan_history : {};
      const balance = Math.max(0, Number(debt.opening_balance || 0) - paidThroughMonth);
      return {
        ...debt,
        current_balance: Number(balance.toFixed(2)),
        monthly_plan: Number(planHistory[monthKey] ?? debt.monthly_plan ?? 0),
        is_active: balance > 0,
      };
    });
}

export async function createDebt({ name, type, balance, monthlyPlan = 0, apr = null, focusOrder = null, startMonthKey = FIRST_MONTH }) {
  const user = await requireUser();
  const clean = String(name || '').trim();
  const opening = Math.max(0, Number(balance || 0));
  const plan = Math.max(0, Number(monthlyPlan || 0));
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
    apr: apr === '' || apr == null ? null : Math.max(0, Number(apr)),
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
    const plan = Math.max(0, Number(changes.monthlyPlan || 0));
    const current = unwrap(await supabase.from('money_debts').select('monthly_plan_history').eq('id', id).single());
    payload.monthly_plan = plan;
    payload.monthly_plan_history = { ...(current?.monthly_plan_history || {}), [monthKey]: plan };
  }
  if (changes.apr !== undefined) payload.apr = changes.apr === '' || changes.apr == null ? null : Math.max(0, Number(changes.apr));
  if (changes.focusOrder !== undefined) payload.focus_order = changes.focusOrder == null ? null : Number(changes.focusOrder);
  if (changes.active !== undefined) payload.is_active = Boolean(changes.active);
  return unwrap(await supabase.from('money_debts').update(payload).eq('id', id).select().single());
}

export async function getMonthBundle(monthKey) {
  let month = await getMonth(monthKey);
  if (!month) {
    await createMonth(monthKey);
    month = await getMonth(monthKey);
  }
  const [monthItems, payments, debts, categories] = await Promise.all([
    unwrap(await supabase.from('money_month_items').select('*').eq('month_id', month.id).order('due_date', { ascending: true, nullsFirst: false }).order('name_snapshot')),
    unwrap(await supabase.from('money_payments').select('*').eq('month_id', month.id).order('payment_date', { ascending: false }).order('created_at', { ascending: false })),
    listDebtsAsOf(monthKey),
    listCategories(),
  ]);
  return { month, monthItems: monthItems || [], payments: payments || [], debts, categories };
}

export async function recordPayment({ monthId, type, amount, date, monthItemId = null, debtId = null, note = '' }) {
  await requireUser();
  const params = {
    p_month_id: monthId,
    p_payment_type: type,
    p_amount: Number(amount),
    p_payment_date: date,
    p_month_item_id: monthItemId,
    p_debt_id: debtId,
    p_note: note || null,
  };
  const { data, error } = await supabase.rpc('money_record_payment', params);
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
  const debts = await listDebts({ includeCompleted: true });
  const bundles = await Promise.all(months.map(async (month) => {
    const [monthItems, payments] = await Promise.all([
      unwrap(await supabase.from('money_month_items').select('*').eq('month_id', month.id)),
      unwrap(await supabase.from('money_payments').select('*').eq('month_id', month.id)),
    ]);
    return { month, monthItems: monthItems || [], payments: payments || [] };
  }));
  return { months, debts, bundles };
}
