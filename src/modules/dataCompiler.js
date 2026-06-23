const $ = id => document.getElementById(id);

let initialized = false;

const requiredFields = [
  { id: 'compilerCodigo', label: 'Codigo do Produto' },
  { id: 'compilerTitulo', label: 'Titulo' },
  { id: 'compilerEan', label: 'EAN' },
  { id: 'compilerFornecedor', label: 'Fornecedor' },
];

function getValue(id) {
  return $(id)?.value?.trim() || '';
}

function setStatus(message, type = '') {
  const status = $('compilerStatus');
  if (!status) return;
  status.textContent = message;
  status.dataset.type = type;
}

function addSection(parts, title, value) {
  if (!value) return;
  parts.push('', `${title}:`, '', value);
}

function getMissingRequiredFields() {
  return requiredFields
    .filter(field => !getValue(field.id))
    .map(field => field.label);
}

function buildTxt() {
  const codigo = getValue('compilerCodigo');
  const titulo = getValue('compilerTitulo');
  const ean = getValue('compilerEan');
  const fornecedor = getValue('compilerFornecedor');

  const parts = [
    codigo,
    titulo,
    `EAN: ${ean}`,
    `Fornecedor: ${fornecedor}`,
  ];

  addSection(parts, 'Ficha M3', getValue('compilerFichaM3'));
  addSection(parts, 'Site do Fornecedor', getValue('compilerSiteFornecedor'));
  addSection(parts, 'Placeholder', getValue('compilerPlaceholder'));
  addSection(parts, 'Simplus', getValue('compilerSimplus'));
  addSection(parts, 'E-mail do Fornecedor', getValue('compilerEmailFornecedor'));

  return `${parts.join('\n').trimEnd()}\n`;
}

function ensureValid() {
  const missing = getMissingRequiredFields();
  if (!missing.length) return true;

  setStatus(`Preencha: ${missing.join(', ')}.`, 'error');
  return false;
}

function updateOutput() {
  if (!ensureValid()) {
    const output = $('compilerOutput');
    if (output) output.value = '';
    return '';
  }

  const text = buildTxt();
  const output = $('compilerOutput');
  if (output) output.value = text;
  setStatus('TXT gerado.', 'ok');
  return text;
}

function downloadTxt() {
  const text = updateOutput();
  if (!text) return;

  const codigo = getValue('compilerCodigo') || 'produto';
  const filename = `${codigo.replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  setStatus('Arquivo .txt baixado.', 'ok');
}

async function copyTxt() {
  const text = updateOutput();
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    setStatus('TXT copiado.', 'ok');
  } catch {
    const output = $('compilerOutput');
    output?.focus();
    output?.select();
    document.execCommand('copy');
    setStatus('TXT copiado.', 'ok');
  }
}

function clearFields() {
  document.querySelectorAll('[data-compiler-field]').forEach(field => {
    field.value = '';
  });

  const output = $('compilerOutput');
  if (output) output.value = '';
  setStatus('', '');
  $('compilerCodigo')?.focus();
}

function bindEvents() {
  $('compilerGenerateBtn')?.addEventListener('click', updateOutput);
  $('compilerDownloadBtn')?.addEventListener('click', downloadTxt);
  $('compilerCopyBtn')?.addEventListener('click', copyTxt);
  $('compilerClearBtn')?.addEventListener('click', clearFields);
}

export const DataCompiler = {
  init() {
    if (initialized) return;
    initialized = true;
    bindEvents();
  },
};
