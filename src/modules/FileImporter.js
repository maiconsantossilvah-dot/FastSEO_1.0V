/**
 * modules/FileImporter.js
 * -----------------------
 * Entrada unica para importar arquivos no input principal.
 */

import { Utils } from '../utils/index.js';

const ACCEPT = [
  '.pdf',
  'application/pdf',
  '.xlsx',
  '.xls',
  '.csv',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
].join(',');

const spreadsheetHandler = async file => {
  const { SpreadsheetReader } = await import('./SpreadsheetReader.js');
  return SpreadsheetReader.process(file);
};

const FILE_HANDLERS = {
  pdf: async file => {
    const { PDFReader } = await import('./PDFReader.js');
    return PDFReader.process(file);
  },
  xlsx: spreadsheetHandler,
  xls: spreadsheetHandler,
  csv: spreadsheetHandler,
};

const getImportButton = () =>
  document.getElementById('importFileBtn') || document.getElementById('pdfBtn');

const getExtension = file =>
  String(file?.name || '').split('.').pop().toLowerCase().trim();

function setButtonBusy(on) {
  const btn = getImportButton();
  if (!btn) return;

  if (on) {
    btn.dataset.defaultText = btn.dataset.defaultText || btn.textContent;
    btn.textContent = 'Lendo...';
    btn.disabled = true;
    return;
  }

  btn.textContent = btn.dataset.defaultText || 'Importar arquivo';
  btn.disabled = false;
}

function unsupportedFile(file) {
  const ext = getExtension(file) || 'arquivo';
  Utils.showToast(`Formato nao suportado: ${ext}`, '#DC2626');
  return false;
}

function ensureInput() {
  let input = document.getElementById('_fileImportInput');
  if (!input) {
    input = document.createElement('input');
    input.type = 'file';
    input.id = '_fileImportInput';
    input.style.cssText = 'display:none;position:fixed;left:-9999px';
    document.body.appendChild(input);
  }

  input.accept = ACCEPT;
  const fresh = input.cloneNode();
  input.replaceWith(fresh);
  fresh.id = '_fileImportInput';
  fresh.accept = ACCEPT;
  fresh.addEventListener('change', () => FileImporter.importFile(fresh.files?.[0]));
  return fresh;
}

export const FileImporter = {
  open() {
    ensureInput().click();
  },

  async importFile(file) {
    if (!file) return false;

    const handler = FILE_HANDLERS[getExtension(file)] || unsupportedFile;
    setButtonBusy(true);

    try {
      return await handler(file);
    } finally {
      setButtonBusy(false);
    }
  },
};
