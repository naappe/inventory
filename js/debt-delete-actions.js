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

    const { count, error: countError } = await supabase
      .from('money_payments')
      .select('id', { count: 'exact', head: true })
      .eq('debt_id', debtId)
      .is('reversed_at', null);
    if (countError) throw countError;

    if (Number(count || 0) > 0) {
      alert(`${debt.name} has recorded payments. Reverse those payments first if you really want to delete this ${debt.debt_type}. This protects your payment history.`);
      return;
    }

    const ok = confirm(`Delete ${debt.name}?\n\nThis will permanently remove this ${debt.debt_type} account. Use this only for a wrong or unwanted entry.`);
    if (!ok) return;

    const { error } = await supabase.from('money_debts').delete().eq('id', debtId);
    if (error) throw error;
    window.location.reload();
  } catch (error) {
    console.error(error);
    alert(error?.message || 'Could not delete this loan or credit.');
  }
}, true);
