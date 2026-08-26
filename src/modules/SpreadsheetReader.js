/**
 * modules/SpreadsheetReader.js
 * ----------------------------
 * Le planilhas e envia linhas escolhidas para o input principal.
 */

import { PipelineUI } from '../components/PipelineUI.js';
import { Utils }      from '../utils/index.js';
import { APP_CONFIG } from '../config.js';
import { loadExternalScript } from '../utils/loadExternalScript.js';
import { AppState }   from './state.js';

const XLSX_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
const XLSX_INTEGRITY = 'sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw';
const MAX_PREVIEW_ROWS = 80;

let _loaded = false;

const $ = id => document.getElementById(id);

const state = {
  file: null,
  workbook: null,
  sheetName: '',
  rows: [],
  headers: [],
  dataRows: [],
  selectedRowNumber: null,
  query: '',
};

async function loadXlsx() {
  if (_loaded || window.XLSX) {
    _loaded = true;
    return;
  }

  await loadExternalScript({
    src: XLSX_CDN,
    integrity: XLSX_INTEGRITY,
    globalName: 'XLSX',
    errorMessage: 'Falha ao carregar leitor de planilhas',
  });
  _loaded = true;
}

function cleanCell(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalize(value) {
  return cleanCell(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function columnName(index) {
  let n = index + 1;
  let name = '';

  while (n > 0) {
    const mod = (n - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    n = Math.floor((n - mod) / 26);
  }

  return `Coluna ${name}`;
}

function filledCount(row = []) {
  return row.filter(value => cleanCell(value)).length;
}

function headerScore(row = []) {
  const joined = normalize(row.join(' '));
  const hits = ['codigo', 'cod', 'ean', 'descricao', 'produto', 'fornecedor', 'marca', 'modelo']
    .filter(term => joined.includes(term)).length;
  return filledCount(row) + hits * 3;
}

function findHeaderIndex(rows) {
  const candidates = rows
    .slice(0, 15)
    .map((row, index) => ({ index, score: headerScore(row), filled: filledCount(row) }))
    .filter(item => item.filled >= 2)
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  return best && best.score >= 5 ? best.index : -1;
}

function makeHeaders(row = [], width = 0) {
  const seen = new Map();

  return Array.from({ length: width }, (_, index) => {
    const base = cleanCell(row[index]) || columnName(index);
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count ? `${base} ${count + 1}` : base;
  });
}

function readRows(sheetName) {
  const sheet = state.workbook.Sheets[sheetName];
  const rawRows = window.XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    blankrows: false,
    defval: '',
  });

  return rawRows
    .map(row => row.map(cleanCell))
    .filter(row => row.some(Boolean));
}

function setSheet(sheetName) {
  state.sheetName = sheetName;
  state.rows = readRows(sheetName);

  const width = Math.max(1, ...state.rows.map(row => row.length));
  const headerIndex = findHeaderIndex(state.rows);
  const headerRow = headerIndex >= 0 ? state.rows[headerIndex] : [];
  const dataStart = headerIndex >= 0 ? headerIndex + 1 : 0;

  state.headers = makeHeaders(headerRow, width);
  state.dataRows = state.rows
    .slice(dataStart)
    .map((row, index) => ({
      row,
      rowNumber: dataStart + index + 1,
      search: normalize(row.join(' ')),
    }))
    .filter(item => item.row.some(Boolean));
  state.selectedRowNumber = state.dataRows[0]?.rowNumber || null;
}

function filteredRows() {
  const query = normalize(state.query);
  const rows = query
    ? state.dataRows.filter(item => item.search.includes(query))
    : state.dataRows;
  return rows.slice(0, MAX_PREVIEW_ROWS);
}

function selectedItem() {
  return state.dataRows.find(item => item.rowNumber === state.selectedRowNumber) || filteredRows()[0] || null;
}

function dataColumns(rows = state.dataRows) {
  const width = state.headers.length;
  return Array.from({ length: width }, (_, index) => index)
    .filter(index => rows.some(item => cleanCell(item.row[index])));
}

function formatRow(item) {
  const cols = dataColumns([item]);
  const lines = [
    `Dados extraidos da planilha: ${state.file?.name || ''}`,
    `Aba: ${state.sheetName}`,
    `Linha: ${item.rowNumber}`,
    '',
  ];

  cols.forEach(index => {
    const value = cleanCell(item.row[index]);
    if (value) lines.push(`${state.headers[index]}: ${value}`);
  });

  return lines.join('\n').trim();
}

function formatAllRows() {
  const cols = dataColumns();
  const lines = [
    `Dados extraidos da planilha: ${state.file?.name || ''}`,
    `Aba: ${state.sheetName}`,
    `Linhas: ${state.dataRows.length}`,
    `Colunas: ${cols.length}`,
    '',
  ];

  state.dataRows.forEach(item => {
    lines.push(`--- Linha ${item.rowNumber} ---`);
    cols.forEach(index => {
      const value = cleanCell(item.row[index]);
      if (value) lines.push(`${state.headers[index]}: ${value}`);
    });
    lines.push('');
  });

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function previewColumns(rows) {
  const cols = dataColumns(rows);
  return cols.length ? cols : Array.from({ length: state.headers.length }, (_, index) => index);
}

function closeModal() {
  $('spreadsheetModalOverlay')?.remove();
  document.removeEventListener('keydown', escHandler);
}

function escHandler(event) {
  if (event.key === 'Escape') closeModal();
}

function renderSheets() {
  const select = $('sheetSelect');
  if (!select) return;

  select.innerHTML = state.workbook.SheetNames
    .map(name => `<option value="${Utils.escHtml(name)}"${name === state.sheetName ? ' selected' : ''}>${Utils.escHtml(name)}</option>`)
    .join('');
}

function renderTable() {
  const table = $('sheetPreviewTable');
  const status = $('sheetStatus');
  if (!table) return;

  const rows = filteredRows();
  const selectedVisible = rows.some(item => item.rowNumber === state.selectedRowNumber);
  state.selectedRowNumber = selectedVisible ? state.selectedRowNumber : rows[0]?.rowNumber || null;

  if (!rows.length) {
    table.style.minWidth = '';
    table.innerHTML = '<tbody><tr><td class="sheet-empty">Nenhuma linha encontrada.</td></tr></tbody>';
    if (status) status.textContent = '0 linhas';
    renderSelected();
    return;
  }

  const cols = previewColumns(rows);
  table.style.minWidth = `${Math.max(760, (cols.length + 1) * 150)}px`;
  const head = cols
    .map(index => `<th>${Utils.escHtml(state.headers[index])}</th>`)
    .join('');
  const body = rows
    .map(item => {
      const selected = item.rowNumber === state.selectedRowNumber ? ' is-selected' : '';
      const cells = cols
        .map(index => `<td>${Utils.escHtml(cleanCell(item.row[index]))}</td>`)
        .join('');
      return `<tr class="sheet-row${selected}" data-row-number="${item.rowNumber}"><td class="sheet-row-index">${item.rowNumber}</td>${cells}</tr>`;
    })
    .join('');

  table.innerHTML = `<thead><tr><th>Linha</th>${head}</tr></thead><tbody>${body}</tbody>`;
  if (status) {
    const total = state.dataRows.length;
    const shown = rows.length;
    status.textContent = `${shown}/${total} linhas, ${cols.length} colunas`;
  }

  renderSelected();
}

function renderSelected() {
  const pre = $('sheetLinePreview');
  const btn = $('sheetUseBtn');
  const allBtn = $('sheetUseAllBtn');
  const item = selectedItem();

  if (btn) btn.disabled = !item;
  if (allBtn) allBtn.disabled = !state.dataRows.length;
  if (!pre) return;

  pre.textContent = item ? formatRow(item) : 'Escolha uma linha da planilha.';
}

function openModal() {
  closeModal();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'spreadsheetModalOverlay';
  overlay.innerHTML = `
    <div class="modal modal--sheet">
      <div class="modal-hdr">
        <span class="modal-title">Importar planilha</span>
        <button class="modal-close" id="sheetCloseBtn">x</button>
      </div>
      <div class="modal-body sheet-modal-body">
        <div class="sheet-file-name">${Utils.escHtml(state.file?.name || '')}</div>
        <div class="sheet-toolbar">
          <label>
            <span>Aba</span>
            <select id="sheetSelect"></select>
          </label>
          <label class="sheet-search">
            <span>Buscar</span>
            <input type="text" id="sheetSearch" placeholder="Codigo, EAN, produto, fornecedor..." autocomplete="off">
          </label>
          <span class="sheet-status" id="sheetStatus"></span>
        </div>
        <div class="sheet-preview-wrap">
          <table class="sheet-preview-table" id="sheetPreviewTable"></table>
        </div>
        <div class="sheet-line-box">
          <div class="sheet-line-title">Dados que vao para o input</div>
          <pre id="sheetLinePreview"></pre>
        </div>
      </div>
      <div class="modal-ftr sheet-modal-footer">
        <button class="btn btn-secondary" id="sheetCancelBtn">Cancelar</button>
        <button class="btn btn-secondary" id="sheetUseBtn">Usar linha selecionada</button>
        <button class="btn btn-primary" id="sheetUseAllBtn">Usar toda a aba</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  document.addEventListener('keydown', escHandler);

  overlay.addEventListener('click', event => {
    if (event.target === overlay) closeModal();
  });
  $('sheetCloseBtn')?.addEventListener('click', closeModal);
  $('sheetCancelBtn')?.addEventListener('click', closeModal);
  $('sheetSelect')?.addEventListener('change', event => {
    setSheet(event.target.value);
    state.query = '';
    const search = $('sheetSearch');
    if (search) search.value = '';
    renderTable();
  });
  $('sheetSearch')?.addEventListener('input', event => {
    state.query = event.target.value;
    renderTable();
  });
  $('sheetPreviewTable')?.addEventListener('click', event => {
    const row = event.target.closest('tr[data-row-number]');
    if (!row) return;
    state.selectedRowNumber = Number(row.dataset.rowNumber);
    renderTable();
  });
  $('sheetPreviewTable')?.addEventListener('dblclick', () => useSelected());
  $('sheetUseBtn')?.addEventListener('click', () => useSelected());
  $('sheetUseAllBtn')?.addEventListener('click', () => useAllRows());

  renderSheets();
  renderTable();
}

function useSelected() {
  const item = selectedItem();
  if (!item) return;

  sendToInput(formatRow(item));
  PipelineUI.log(`Planilha importada: ${state.file?.name || ''}, linha ${item.rowNumber}`, 'o');
  Utils.showToast('Linha da planilha enviada ao input');
  closeModal();
}

function useAllRows() {
  if (!state.dataRows.length) return;

  sendToInput(formatAllRows());
  PipelineUI.log(`Planilha importada: ${state.file?.name || ''}, ${state.dataRows.length} linhas`, 'o');
  Utils.showToast('Planilha enviada ao input');
  closeModal();
}

function sendToInput(text) {
  const input = $('inputText');
  if (input) {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  AppState.pdfTexto = '';
  AppState.inputSource = 'spreadsheet';

  if (text.length > APP_CONFIG.inputMaxChars) {
    PipelineUI.log(`Planilha grande: ${text.length.toLocaleString('pt-BR')} caracteres no input.`, 'w');
    Utils.showToast('Planilha grande: revise o limite do agente', '#D97706');
  }
}

export const SpreadsheetReader = {
  async process(file) {
    try {
      PipelineUI.log(`Lendo planilha: ${file.name}`, 'i');
      await loadXlsx();

      const buffer = await file.arrayBuffer();
      state.file = file;
      state.workbook = window.XLSX.read(buffer, { type: 'array', cellDates: false });

      if (!state.workbook.SheetNames.length) throw new Error('Planilha sem abas.');

      setSheet(state.workbook.SheetNames[0]);

      if (!state.dataRows.length) {
        Utils.showToast('Planilha sem linhas para importar', '#D97706');
        PipelineUI.log('Planilha sem linhas para importar.', 'w');
        return false;
      }

      openModal();
      Utils.showToast('Planilha carregada');
      return true;
    } catch (err) {
      PipelineUI.log(`Erro ao ler planilha: ${err.message}`, 'e');
      Utils.showToast('Erro ao ler a planilha', '#DC2626');
      console.error('SpreadsheetReader:', err);
      return false;
    }
  },
};
