let activeCleanup = null;

function root() {
  return document.getElementById('sheet-root');
}

export function closeSheet() {
  if (activeCleanup) activeCleanup();
  activeCleanup = null;
  const node = root();
  if (node) node.innerHTML = '';
  document.body.classList.remove('sheet-open');
}

export function setSheetPreview(html) {
  const el = document.querySelector('[data-sheet-preview]');
  if (el) el.innerHTML = html;
}

export function openSheet({ title, subtitle = '', body = '', submitLabel = 'Save', onSubmit, onReady }) {
  closeSheet();
  const node = root();
  if (!node) throw new Error('Sheet root is missing.');
  node.innerHTML = `
    <div class="sheet-backdrop" data-sheet-close></div>
    <aside class="money-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <div class="sheet-handle" aria-hidden="true"></div>
      <header class="sheet-header">
        <div><p class="eyebrow">MY MONEY PLAN</p><h2 id="sheet-title">${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div>
        <button class="icon-button" type="button" data-sheet-close aria-label="Close">×</button>
      </header>
      <form class="sheet-form" novalidate>
        <div class="sheet-body">${body}<div class="sheet-preview" data-sheet-preview></div><p class="form-error" data-sheet-error hidden></p></div>
        <footer class="sheet-footer">
          <button type="button" class="button secondary" data-sheet-close>Cancel</button>
          <button type="submit" class="button primary" data-sheet-submit>${submitLabel}</button>
        </footer>
      </form>
    </aside>`;
  document.body.classList.add('sheet-open');

  const form = node.querySelector('form');
  const submit = node.querySelector('[data-sheet-submit]');
  const errorBox = node.querySelector('[data-sheet-error]');
  const closeButtons = node.querySelectorAll('[data-sheet-close]');
  const close = () => closeSheet();
  closeButtons.forEach((btn) => btn.addEventListener('click', close));

  const escapeHandler = (event) => { if (event.key === 'Escape') closeSheet(); };
  document.addEventListener('keydown', escapeHandler);
  activeCleanup = () => document.removeEventListener('keydown', escapeHandler);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.hidden = true;
    submit.disabled = true;
    submit.textContent = 'Saving…';
    try {
      const values = Object.fromEntries(new FormData(form).entries());
      await onSubmit(values, form);
      closeSheet();
    } catch (error) {
      errorBox.textContent = error?.message || 'Not saved — retry.';
      errorBox.hidden = false;
      submit.disabled = false;
      submit.textContent = submitLabel;
    }
  });

  requestAnimationFrame(() => {
    const first = form.querySelector('input:not([type="hidden"]),select,textarea');
    if (first) first.focus();
    if (onReady) onReady(form);
  });
  return form;
}

export const field = {
  money(name, label, value = '', extra = '') {
    return `<label class="field"><span>${label}</span><div class="money-input"><b>MVR</b><input name="${name}" type="number" min="0" step="0.01" value="${value}" ${extra}></div></label>`;
  },
  text(name, label, value = '', extra = '') {
    return `<label class="field"><span>${label}</span><input name="${name}" type="text" value="${String(value).replace(/"/g, '&quot;')}" ${extra}></label>`;
  },
  number(name, label, value = '', extra = '') {
    return `<label class="field"><span>${label}</span><input name="${name}" type="number" value="${value}" ${extra}></label>`;
  },
  date(name, label, value = '', extra = '') {
    return `<label class="field"><span>${label}</span><input name="${name}" type="date" value="${value}" ${extra}></label>`;
  },
  select(name, label, options = [], value = '') {
    return `<label class="field"><span>${label}</span><select name="${name}">${options.map((o) => `<option value="${o.value}" ${String(o.value) === String(value) ? 'selected' : ''}>${o.label}</option>`).join('')}</select></label>`;
  },
};
