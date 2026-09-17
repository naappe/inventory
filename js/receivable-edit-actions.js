import { supabase } from './supabase-client.js';
import { openSheet, field } from './money-sheets.js';

function cleanText(value) {
  return String(value ?? '').trim();
}

async function loadReceivable(id) {
  const { data, error } = await supabase
    .from('money_receivables')
    .select('id,name,opening_balance,current_balance,expected_repayment_date,remarks,is_active')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

async function saveReceivable(id, values) {
  const payload = {
    name: cleanText(values.name),
    expected_repayment_date: values.expectedRepaymentDate || null,
    remarks: cleanText(values.remarks) || null,
  };
  if (!payload.name) throw new Error('Name is required.');
  const { error } = await supabase.from('money_receivables').update(payload).eq('id', id);
  if (error) throw error;
}

document.addEventListener('click', async (event) => {
  const trigger = event.target.closest('[data-action="edit-receivable"]');
  if (!trigger) return;
  event.preventDefault();
  event.stopPropagation();

  try {
    const row = await loadReceivable(trigger.dataset.id);
    openSheet({
      title: 'Edit money lent',
      subtitle: `Original amount MVR ${Number(row.opening_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      body: `${field.text('name','Person / borrower',row.name || '','required')}${field.date('expectedRepaymentDate','Expected repayment date',row.expected_repayment_date || '')}${field.text('remarks','Remarks',row.remarks || '')}<p class="helper">The original amount and transaction history are kept unchanged so your audit trail stays accurate.</p>`,
      submitLabel: 'Save changes',
      onSubmit: async (values) => {
        await saveReceivable(row.id, values);
        window.location.reload();
      },
    });
  } catch (error) {
    console.error(error);
    alert(error?.message || 'Could not open this record for editing.');
  }
}, true);
