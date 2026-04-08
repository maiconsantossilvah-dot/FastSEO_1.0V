/**
 * HistoryUI.js
 * ─────────────
 * Painel de histórico colapsável com paginação.
 *
 * Comportamento:
 *  - Inicia FECHADO — nenhum item renderizado no DOM
 *  - Ao abrir, renderiza apenas a página atual (PAGE_SIZE itens)
 *  - Ao fechar, limpa o DOM da lista (libera memória)
 *  - Contador no cabeçalho atualizado sempre, mesmo fechado
 *  - Busca e filtro resetam para página 1
 */

import { History }    from './history.js';
import { AppState }   from './state.js';
import { PipelineUI } from './PipelineUI.js';
import { Utils }      from './index.js';

const PAGE_SIZE = 10;
const $         = id => document.getElementById(id);

let _currentPage = 1;
let _isOpen      = false;

export const HistoryUI = {

  // Chamado pelo History.startSync() a cada atualização do Firestore.
  // Só atualiza o badge; não toca na lista enquanto o painel está fechado.
  render() {
    _updateCounter();
    if (_isOpen) _renderList();
  },

  resetPage() { _currentPage = 1; },

  // Abre/fecha o painel ao clicar no cabeçalho
  toggle() {
    _isOpen = !_isOpen;
    const body    = $('historicoBody');
    const chevron = $('historicoChevron');

    if (_isOpen) {
      body.style.display = 'flex';
      requestAnimationFrame(() => body.classList.add('hist-body--open'));
      if (chevron) chevron.style.transform = 'rotate(180deg)';
      _renderList();
    } else {
      body.classList.remove('hist-body--open');
      if (chevron) chevron.style.transform = 'rotate(0deg)';
      setTimeout(() => {
        body.style.display = 'none';
        const lista = $('historicoLista');
        if (lista) lista.innerHTML = '';
      }, 220);
    }
  },

  _restore(item) {
    AppState.pipeline.result = { ficha: item.ficha, conteudo: item.conteudo, bivolt: item.bivolt };
    PipelineUI.showResults(item.ficha, '', item.conteudo, item.bivolt, false);
    const vo = $('validacaoOut'); if (vo) vo.textContent = '';
    $('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    PipelineUI.log(`📂 Resultado de ${item.data} restaurado.`, 'o');
  },
};

// ── Privados ──────────────────────────────────────────────────

function _getFiltered() {
  const busca  = ($('historicoBusca')?.value || '').toLowerCase().trim();
  const filtro =  $('historicoFiltro')?.value || 'todos';
  let items    = History.getAll();
  if (filtro === 'bivolt') items = items.filter(i => i.bivolt);
  if (filtro === 'padrao') items = items.filter(i => !i.bivolt);
  if (busca)               items = items.filter(i =>
    (i.preview || '').toLowerCase().includes(busca) ||
    (i.data    || '').toLowerCase().includes(busca)
  );
  return items;
}

function _updateCounter() {
  const total   = History.getAll().length;
  const countEl = $('historicoCount');
  if (!countEl) return;
  if (total > 0) {
    countEl.textContent = `${total} ficha${total !== 1 ? 's' : ''}`;
    countEl.style.display = '';
  } else {
    countEl.style.display = 'none';
  }
}

function _renderList() {
  const lista = $('historicoLista');
  if (!lista) return;

  const filtered   = _getFiltered();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (_currentPage > totalPages) _currentPage = totalPages;

  const start = (_currentPage - 1) * PAGE_SIZE;
  const page  = filtered.slice(start, start + PAGE_SIZE);

  lista.innerHTML = '';

  // Estado vazio
  if (filtered.length === 0) {
    const busca  = $('historicoBusca')?.value?.trim();
    const filtro = $('historicoFiltro')?.value;
    lista.innerHTML = `
      <p style="color:var(--color-text-muted);font-size:12px;text-align:center;padding:24px 0">
        ${busca || filtro !== 'todos'
          ? 'Nenhum resultado encontrado para o filtro aplicado.'
          : 'Nenhum resultado salvo ainda.'}
      </p>`;
    return;
  }

  // Itens via fragment (uma só inserção no DOM)
  const todos    = History.getAll();
  const fragment = document.createDocumentFragment();

  page.forEach(item => {
    const el = document.createElement('div');
    el.className    = 'hist-item';
    el.dataset.id   = String(item.id || '');
    el.title        = 'Clique para restaurar esta ficha';
    el.innerHTML    = `
      <div class="hist-meta">
        <span class="hist-date">${Utils.escHtml(item.data || '')}</span>
        ${item.bivolt ? '<span class="hist-bivolt-tag">⚡ BIVOLT</span>' : ''}
      </div>
      <div class="hist-preview">${Utils.escHtml(item.preview || '(sem preview)')}</div>
    `;
    el.addEventListener('click', () => {
      const found = todos.find(t => String(t.id) === el.dataset.id);
      if (found) HistoryUI._restore(found);
    });
    fragment.appendChild(el);
  });
  lista.appendChild(fragment);

  // Paginação (só se > 1 página)
  if (totalPages > 1) {
    const nav = document.createElement('div');
    nav.style.cssText = 'display:flex;align-items:center;justify-content:space-between;' +
      'padding:10px 0 2px;border-top:1px solid var(--color-border);margin-top:8px;gap:8px;';

    const info = document.createElement('span');
    info.style.cssText = 'font-size:11px;color:var(--color-text-muted);font-family:var(--font-mono);flex:1;';
    info.textContent   = `${start + 1}–${Math.min(_currentPage * PAGE_SIZE, filtered.length)} de ${filtered.length} fichas`;

    const btnGroup = document.createElement('div');
    btnGroup.style.cssText = 'display:flex;align-items:center;gap:6px;';

    const pageLabel = document.createElement('span');
    pageLabel.style.cssText = 'font-size:11px;font-family:var(--font-mono);color:var(--color-text-secondary);padding:0 4px;';
    pageLabel.textContent   = `${_currentPage} / ${totalPages}`;

    const btnPrev = _pageBtn('← Anterior', _currentPage <= 1);
    const btnNext = _pageBtn('Próximo →',  _currentPage >= totalPages);

    btnPrev.addEventListener('click', () => {
      if (_currentPage > 1) { _currentPage--; _renderList(); _scrollPanel(); }
    });
    btnNext.addEventListener('click', () => {
      if (_currentPage < totalPages) { _currentPage++; _renderList(); _scrollPanel(); }
    });

    btnGroup.append(btnPrev, pageLabel, btnNext);
    nav.append(info, btnGroup);
    lista.appendChild(nav);
  }
}

function _pageBtn(label, disabled) {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.disabled    = disabled;
  btn.style.cssText =
    `height:26px;padding:0 10px;border:1px solid var(--color-border);border-radius:6px;` +
    `background:transparent;color:${disabled ? 'var(--color-text-muted)' : 'var(--color-text-secondary)'};` +
    `font-family:var(--font-mono);font-size:10px;font-weight:500;` +
    `cursor:${disabled ? 'not-allowed' : 'pointer'};opacity:${disabled ? '.4' : '1'};transition:all .12s;`;
  if (!disabled) {
    btn.addEventListener('mouseenter', () => {
      btn.style.background   = 'var(--color-bg-subtle)';
      btn.style.color        = 'var(--color-text-primary)';
      btn.style.borderColor  = 'var(--color-border-strong)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background   = 'transparent';
      btn.style.color        = 'var(--color-text-secondary)';
      btn.style.borderColor  = 'var(--color-border)';
    });
  }
  return btn;
}

function _scrollPanel() {
  $('historicoPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
