import { supabase } from './supabase-client.js';

function addDeleteButtons() {
  document.querySelectorAll('.liability-card-head').forEach((head) => {
    if (head.querySelector('[data-action="delete-debt"]')) return;
    const edit = head.querySelector('[data-action="edit-debt"]');
    if (!edit?.dataset.id) return;
    const actions = document.createElement('div');
    actions.className = 'row-end';
    const parent = edit.parentElement;
    if (parent?.classList.contains('row-end')) {
      const button = document.createElement('button');
      button.className = 'text-button danger-text';
      button.dataset.action = 'delete-debt';
      button.dataset.id = edit.dataset.id;
      button.textContent = 'Delete';
      parent.appendChild(button);
      return;
    }
    const button = document.createElement('button');
    button.className = 'text-button danger-text';
    button.dataset.action = 'delete-debt';
    button.dataset.id = edit.dataset.id;
    button.textContent = 'Delete';
    edit.replaceWith(actions);
    actions.append(edit, button);
  });
}

const observer = new MutationObserver(addDeleteButtons);
observer.observe(document.getElementById('app'), { childList: true, subtree: true });
addDeleteButtons();

document.addEventListener('click', async (event) => {
  const trigger = event.target.closest('[data-action="delete-debt"]');
  if (!trigger) return;
  event.preventDefault();
  event.stopPropagation();

  const debtId = trigger.dataset.id;
  try {
    const { data: debt, error: debtError } = await supabase
      .from('money_debts')
      .select('id,name,debt_type')
      .eq('id', debtId)
      .single();
    if (debtError) throw debtError;

    const { data: payments, error: paymentsError } = await supabase
      .from('money_payments')
      .select('id,amount,reversed_at')
      .eq('debt_id', debtId);
    if (paymentsError) throw paymentsError;

    const allPayments = payments || [];
    const activePayments = allPayments.filter((p) => !p.reversed_at);
    const activeTotal = activePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const warning = allPayments.length
      ? `\n\nThis account has ${allPayments.length} payment record${allPayments.length === 1 ? '' : 's'}${activePayments.length ? `, including ${activePayments.length} active payment${activePayments.length === 1 ? '' : 's'} totaling MVR ${activeTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ' (all reversed)'}.\n\nDeleting will permanently remove the account AND those payment records. This will also remove them from spending/history calculations.`
      : '';

    const ok = confirm(`Delete ${debt.name}?${warning}\n\nUse Delete only when this ${debt.debt_type} entry is wrong or no longer wanted.`);
    if (!ok) return;

    if (allPayments.length) {
      const { error: deletePaymentsError } = await supabase
        .from('money_payments')
        .delete()
        .eq('debt_id', debtId);
      if (deletePaymentsError) throw deletePaymentsError;
    }

    const { error: deleteDebtError } = await supabase.from('money_debts').delete().eq('id', debtId);
    if (deleteDebtError) throw deleteDebtError;
    window.location.reload();
  } catch (error) {
    console.error(error);
    alert(error?.message || 'Could not delete this loan or credit.');
  }
}, true);
