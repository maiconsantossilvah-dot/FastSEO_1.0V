const $ = id => document.getElementById(id);

let initialized = false;

const requiredFields = [
  { id: 'compilerCodigo', label: 'Codigo do Produto' },
  { id: 'compilerTitulo', label: 'Titulo' },
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

function updateOutputAfterImport(message) {
  const missing = getMissingRequiredFields();

  if (missing.length) {
    const output = $('compilerOutput');
    if (output) output.value = '';
    setStatus(`${message} Preencha os obrigatorios para gerar o TXT.`, 'ok');
    return;
  }

  const output = $('compilerOutput');
  if (output) output.value = buildTxt();
  setStatus(message, 'ok');
}

function setPdfButtonBusy(on) {
  const btn = $('compilerPdfBtn');
  if (!btn) return;

  if (on) {
    btn.dataset.defaultText = btn.dataset.defaultText || btn.textContent;
    btn.textContent = 'Lendo PDF...';
    btn.disabled = true;
    return;
  }

  btn.textContent = btn.dataset.defaultText || 'Importar PDF';
  btn.disabled = false;
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
      setStatus('PDF sem texto extraivel. Pode ser um arquivo escaneado.', 'error');
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
  document.querySelectorAll('[data-compiler-field]').forEach(field => {
    field.value = '';
  });

  const output = $('compilerOutput');
  if (output) output.value = '';
  setStatus('', '');
  $('compilerCodigo')?.focus();
}

function bindEvents() {
  bindPdfDrop();
  $('compilerPdfBtn')?.addEventListener('click', openPdfImport);
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
