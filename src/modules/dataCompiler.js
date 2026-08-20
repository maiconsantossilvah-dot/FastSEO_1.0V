const $ = id => document.getElementById(id);

let initialized = false;

// Campos mínimos para gerar o TXT sem deixar dados essenciais de fora.
const requiredFields = [
  { id: 'compilerCodigo', label: 'Código do Produto' },
  { id: 'compilerTitulo', label: 'Título' },
  { id: 'compilerEan', label: 'EAN' },
  { id: 'compilerFornecedor', label: 'Fornecedor' },
];

const PDF_ACCEPT = '.pdf,application/pdf';

function getValue(id) {
  return $(id)?.value?.trim() || '';
}

function setStatus(message, type = '') {
  const status = $('compilerStatus');
  if (!status) return;
  status.textContent = message;
  status.dataset.type = type;
}

function setFieldError(id, message = '') {
  const field = $(id);
  const error = document.querySelector(`[data-error-for="${id}"]`);
  field?.setAttribute('aria-invalid', String(Boolean(message)));
  if (error) {
    error.textContent = message;
    if (!error.id) error.id = `${id}Error`;
    field?.setAttribute('aria-describedby', error.id);
  }
}

function updateSourceCount() {
  const sourceIds = [
    'compilerFichaM3',
    'compilerSiteFornecedor',
    'compilerPdf',
    'compilerPlaceholder',
    'compilerSimplus',
    'compilerEmailFornecedor',
  ];
  const filled = sourceIds.filter(id => getValue(id)).length;
  const count = $('compilerSourcesCount');
  if (count) count.textContent = `${filled} de ${sourceIds.length} preenchida${filled === 1 ? '' : 's'}`;
}

function updateActionAvailability() {
  const hasOutput = Boolean($('compilerOutput')?.value?.trim());
  ['compilerCopyBtn', 'compilerDownloadBtn'].forEach(id => {
    const button = $(id);
    if (!button) return;
    button.disabled = !hasOutput;
    button.title = hasOutput ? '' : 'Gere o TXT antes de usar esta ação';
  });
  $('compilerOutput')?.closest('.compiler-output-body')?.classList.toggle('has-output', hasOutput);
  const empty = $('compilerOutputEmpty');
  if (empty) empty.hidden = hasOutput;
}

function addSection(parts, title, value) {
  if (!value) return;
  parts.push('', `${title}:`, '', value);
}

function isPdf(file) {
  const name = String(file?.name || '').toLowerCase();
  return file?.type === 'application/pdf' || name.endsWith('.pdf');
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

  // Fontes opcionais só entram quando o campo correspondente tem conteúdo.
  addSection(parts, 'Ficha M3', getValue('compilerFichaM3'));
  addSection(parts, 'Site do Fornecedor', getValue('compilerSiteFornecedor'));
  addSection(parts, 'PDF', getValue('compilerPdf'));
  addSection(parts, 'Placeholder', getValue('compilerPlaceholder'));
  addSection(parts, 'Simplus', getValue('compilerSimplus'));
  addSection(parts, 'E-mail do Fornecedor', getValue('compilerEmailFornecedor'));

  return `${parts.join('\n').trimEnd()}\n`;
}

function ensureValid() {
  const missing = getMissingRequiredFields();
  requiredFields.forEach(field => {
    setFieldError(field.id, missing.includes(field.label) ? `${field.label} é obrigatório.` : '');
  });
  if (!missing.length) return true;

  setStatus(`Preencha: ${missing.join(', ')}.`, 'error');
  const firstMissing = requiredFields.find(field => missing.includes(field.label));
  $(firstMissing?.id)?.focus();
  return false;
}

// Atualiza a prévia e retorna o texto final para copiar/baixar.
function updateOutput() {
  if (!ensureValid()) {
    const output = $('compilerOutput');
    if (output) output.value = '';
    updateActionAvailability();
    return '';
  }

  const text = buildTxt();
  const output = $('compilerOutput');
  if (output) output.value = text;
  setStatus('TXT gerado.', 'ok');
  updateActionAvailability();
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

function updateOutputAfterImport(message) {
  const missing = getMissingRequiredFields();

  if (missing.length) {
    const output = $('compilerOutput');
    if (output) output.value = '';
    setStatus(`${message} Preencha os obrigatórios para gerar o TXT.`, 'ok');
    updateActionAvailability();
    return;
  }

  const output = $('compilerOutput');
  if (output) output.value = buildTxt();
  setStatus(message, 'ok');
  updateSourceCount();
  updateActionAvailability();
}

function setPdfButtonBusy(on) {
  const btn = $('compilerPdfBtn');
  if (!btn) return;

  if (on) {
    btn.innerHTML = '<span class="loading-spinner" aria-hidden="true"></span><span>Lendo PDF...</span>';
    btn.disabled = true;
    return;
  }

  btn.innerHTML = '<i data-lucide="file-up" aria-hidden="true"></i><span>Importar PDF</span>';
  btn.disabled = false;
  window.lucide?.createIcons?.();
}

function ensurePdfInput() {
  let input = $('compilerPdfInput');
  if (!input) {
    input = document.createElement('input');
    input.type = 'file';
    input.id = 'compilerPdfInput';
    input.style.cssText = 'display:none;position:fixed;left:-9999px';
    document.body.appendChild(input);
  }

  // Clona o input para limpar a seleção anterior e permitir importar o mesmo arquivo de novo.
  input.accept = PDF_ACCEPT;
  const fresh = input.cloneNode();
  input.replaceWith(fresh);
  fresh.id = 'compilerPdfInput';
  fresh.accept = PDF_ACCEPT;
  fresh.addEventListener('change', () => importPdf(fresh.files?.[0]));
  return fresh;
}

function openPdfImport() {
  ensurePdfInput().click();
}

async function importPdf(file) {
  if (!file) return;

  if (!isPdf(file)) {
    setStatus('Selecione um arquivo PDF.', 'error');
    return;
  }

  setPdfButtonBusy(true);

  try {
    const { PDFReader } = await import('./PDFReader.js');
    const text = await PDFReader.extractText(file);

    if (!text || text.length < 30) {
      setStatus('PDF sem texto extraível. Pode ser um arquivo escaneado.', 'error');
      return;
    }

    const pdfField = $('compilerPdf');
    if (pdfField) pdfField.value = text;

    const chars = text.length.toLocaleString('pt-BR');
    updateOutputAfterImport(`PDF importado com ${chars} caracteres.`);
  } catch (err) {
    console.error('DataCompiler PDF:', err);
    setStatus(`Erro ao ler PDF: ${err.message}`, 'error');
  } finally {
    setPdfButtonBusy(false);
  }
}

function bindPdfDrop() {
  const pdfField = $('compilerPdf');
  if (!pdfField) return;

  pdfField.addEventListener('dragover', event => {
    event.preventDefault();
    pdfField.style.borderColor = 'rgba(88, 166, 255, .65)';
  });

  pdfField.addEventListener('dragleave', () => {
    pdfField.style.borderColor = '';
  });

  pdfField.addEventListener('drop', event => {
    event.preventDefault();
    pdfField.style.borderColor = '';
    importPdf(event.dataTransfer?.files?.[0]);
  });
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
  const hasContent = [...document.querySelectorAll('[data-compiler-field]')].some(field => field.value.trim());
  if (hasContent && !window.confirm('Limpar todos os dados do compilador?')) return;

  document.querySelectorAll('[data-compiler-field]').forEach(field => {
    field.value = '';
  });

  const output = $('compilerOutput');
  if (output) output.value = '';
  requiredFields.forEach(field => setFieldError(field.id, ''));
  setStatus('', '');
  updateSourceCount();
  updateActionAvailability();
  try { localStorage.removeItem('fastseo_draft_compiler'); } catch { /* noop */ }
  $('compilerCodigo')?.focus();
}

function bindEvents() {
  bindPdfDrop();
  $('compilerPdfBtn')?.addEventListener('click', openPdfImport);
  $('compilerGenerateBtn')?.addEventListener('click', updateOutput);
  $('compilerDownloadBtn')?.addEventListener('click', downloadTxt);
  $('compilerCopyBtn')?.addEventListener('click', copyTxt);
  $('compilerClearBtn')?.addEventListener('click', clearFields);
  document.querySelectorAll('[data-compiler-field]').forEach(field => {
    field.addEventListener('input', () => {
      updateSourceCount();
      if (requiredFields.some(item => item.id === field.id) && field.value.trim()) setFieldError(field.id, '');
    });
  });
}

export const DataCompiler = {
  init() {
    if (initialized) return;
    initialized = true;
    bindEvents();
    updateSourceCount();
    updateActionAvailability();
  },
};
