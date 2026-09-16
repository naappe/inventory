document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-action="set-bank-balance"]');
  if (!trigger) return;

  window.setTimeout(() => {
    const root = document.getElementById('sheet-root');
    if (!root) return;
    const title = root.querySelector('#sheet-title');
    const subtitle = root.querySelector('.sheet-header p:not(.eyebrow)');
    const fieldLabel = root.querySelector('input[name="bankBalance"]')?.closest('.field')?.querySelector(':scope > span');
    const helper = root.querySelector('input[name="bankBalance"]')?.closest('.field')?.nextElementSibling;
    const submit = root.querySelector('[data-sheet-submit]');

    if (title) title.textContent = 'Opening bank balance';
    if (subtitle) subtitle.textContent = 'Balance before this month’s salary and payments';
    if (fieldLabel) fieldLabel.textContent = 'Opening bank balance';
    if (helper?.classList.contains('helper')) helper.textContent = 'Enter the bank balance you had before this month’s salary was deposited. Salary is then added and recorded payments are deducted automatically.';
    if (submit) submit.textContent = 'Save opening balance';
  }, 0);
}, true);
