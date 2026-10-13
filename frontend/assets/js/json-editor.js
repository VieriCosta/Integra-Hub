// Keep JSON as the canonical value so masked credentials and typed parameters survive edits.
document.querySelectorAll('.json-field').forEach(field => {
  const feedback = document.createElement('div');
  feedback.className = 'invalid-feedback';
  feedback.id = `${field.id}-feedback`;
  field.setAttribute('aria-describedby', feedback.id);
  field.after(feedback);
  function validate() {
    let message = '';
    try {
      if (field.value.trim()) {
        const value = JSON.parse(field.value);
        if (!value || typeof value !== 'object' || Array.isArray(value)) message = 'Informe um objeto JSON, por exemplo {"chave":"valor"}.';
      }
    } catch { message = 'JSON inválido. Confira aspas, vírgulas e chaves.'; }
    field.setCustomValidity(message);
    field.classList.toggle('is-invalid', Boolean(message));
    feedback.textContent = message;
    field.setAttribute('aria-invalid', String(Boolean(message)));
    return !message;
  }
  field.addEventListener('input', validate);
  field.addEventListener('change', validate);
  if (!['headers', 'queryParams'].includes(field.id)) return;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'btn btn-sm btn-outline-secondary mb-2';
  toggle.textContent = 'Editar chave / valor';
  field.before(toggle);
  const rows = document.createElement('div');
  rows.hidden = true;
  field.after(rows);
  function synchronize() {
    const result = Object.create(null);
    let error = '';
    rows.querySelectorAll('.parameter-row').forEach(row => {
      const [key, value] = row.querySelectorAll('input');
      if (!key.value.trim()) { if (value.value) error = 'Informe a chave.'; return; }
      if (Object.hasOwn(result, key.value.trim())) error = 'Chaves duplicadas.';
      // Preserve numeric/boolean/object types until the value is actually edited.
      result[key.value.trim()] = value.dataset.originalText === value.value ? JSON.parse(value.dataset.originalValue) : value.value;
    });
    field.value = JSON.stringify(result, null, 2);
    validate();
    toggle.setCustomValidity(error);
    feedback.textContent = error;
    feedback.style.display = error ? 'block' : '';
  }
  function addRow(key = '', value = '') {
    const row = document.createElement('div');
    row.className = 'parameter-row d-flex gap-2 mb-2';
    for (const [label, data] of [['Chave', key], ['Valor', typeof value === 'string' ? value : JSON.stringify(value)]]) {
      const input = document.createElement('input');
      input.className = 'form-control';
      input.placeholder = label;
      input.setAttribute('aria-label', `${field.id}: ${label}`);
      input.value = data;
      if (label === 'Valor') { input.dataset.originalValue = JSON.stringify(value); input.dataset.originalText = data; }
      input.addEventListener('input', synchronize);
      row.append(input);
    }
    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'btn btn-outline-danger'; remove.textContent = 'Remover';
    remove.addEventListener('click', () => { row.remove(); synchronize(); });
    row.append(remove); rows.append(row);
  }
  toggle.addEventListener('click', () => {
    if (toggle.disabled) return;
    if (rows.hidden) {
      if (!validate()) { field.reportValidity(); return; }
      rows.replaceChildren();
      Object.entries(JSON.parse(field.value || '{}')).forEach(([key, value]) => addRow(key, value));
      const add = document.createElement('button');
      add.type = 'button'; add.className = 'btn btn-sm btn-outline-primary mb-2'; add.textContent = 'Adicionar campo';
      add.addEventListener('click', () => addRow()); rows.append(add);
      rows.hidden = false; field.hidden = true; toggle.textContent = 'Editar JSON';
    } else {
      rows.hidden = true; field.hidden = false; toggle.textContent = 'Editar chave / valor';
    }
  });
  document.getElementById('integrationModal').addEventListener('hidden.bs.modal', () => {
    rows.hidden = true; field.hidden = false; toggle.textContent = 'Editar chave / valor'; field.setCustomValidity(''); toggle.setCustomValidity(''); feedback.style.display = ''; field.classList.remove('is-invalid');
  });
});
