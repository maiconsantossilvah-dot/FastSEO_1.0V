/**
 * components/ExemplosModal.js
 * ────────────────────────────
 * Modal do painel de exemplos por categoria.
 * Lê as categorias do módulo Categories e exibe numa interface
 * de navegação: lista de categorias à esquerda, conteúdo à direita.
 */

import { Categories } from './categories.js';
import { AppState }   from './state.js';

export const ExemplosModal = {
  _activeCat: null,

  open() {
    if (document.getElementById('exemplosModalOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'exemplosModalOverlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal modal--exemplos">
        <div class="modal-hdr">
          <span class="modal-title">📚 Exemplos por Categoria</span>
          <button class="modal-close" id="exemplosModalClose">✕</button>
        </div>
        <div class="exemplos-layout">
          <!-- Lista de categorias -->
          <div class="exemplos-sidebar" id="exemplosSidebar"></div>
          <!-- Conteúdo da categoria selecionada -->
          <div class="exemplos-content" id="exemplosContent">
            <div class="exemplos-empty">
              <span style="font-size:28px;opacity:.3">📂</span>
              <p>Selecione uma categoria para ver os exemplos</p>
            </div>
          </div>
        </div>
        <div class="modal-ftr" style="justify-content:flex-end">
          <button class="btn btn-primary" id="exemplosModalClose2">Fechar</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    this._renderSidebar();

    const close = () => this.close();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('#exemplosModalClose')?.addEventListener('click', close);
    overlay.querySelector('#exemplosModalClose2')?.addEventListener('click', close);
    document.addEventListener('keydown', this._esc);
  },

  _renderSidebar() {
    const sidebar = document.getElementById('exemplosSidebar');
    if (!sidebar) return;
    const cats = Categories.getAll();

    if (!cats.length) {
      sidebar.innerHTML = '<p style="font-size:12px;color:rgba(255,255,255,.3);padding:16px">Nenhuma categoria cadastrada.</p>';
      return;
    }

    sidebar.innerHTML = cats.map(c => {
      const hasContent = !!(c.ficha || c.campos || c.copy);
      return `<button class="exemplos-cat-item${this._activeCat === c.id ? ' active' : ''}" data-id="${c.id}">
        <span class="exemplos-cat-dot" style="background:${hasContent ? '#4ade80' : '#374151'}"></span>
        <span class="exemplos-cat-name">${this._esc_html(c.nome || 'Sem nome')}</span>
      </button>`;
    }).join('');

    sidebar.querySelectorAll('.exemplos-cat-item').forEach(btn => {
      btn.addEventListener('click', () => {
        this._activeCat = btn.dataset.id;
        sidebar.querySelectorAll('.exemplos-cat-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._renderContent(btn.dataset.id);
      });
    });

    // Selecionar primeira com conteúdo automaticamente
    if (!this._activeCat) {
      const first = cats.find(c => c.ficha || c.campos || c.copy) || cats[0];
      if (first) {
        this._activeCat = first.id;
        const btn = sidebar.querySelector(`[data-id="${first.id}"]`);
        if (btn) btn.classList.add('active');
        this._renderContent(first.id);
      }
    }
  },

  _renderContent(catId) {
    const content = document.getElementById('exemplosContent');
    if (!content) return;
    const cat = Categories.find(catId);
    if (!cat) return;

    const section = (label, text) => text ? `
      <div class="exemplos-section">
        <div class="exemplos-section-label">${label}</div>
        <pre class="exemplos-section-body">${this._esc_html(text)}</pre>
      </div>` : '';

    content.innerHTML = `
      <div class="exemplos-cat-header">
        <span class="exemplos-cat-title">${this._esc_html(cat.nome || 'Sem nome')}</span>
      </div>
      ${section('Campos prioritários', cat.campos)}
      ${section('Exemplo de ficha ideal', cat.ficha)}
      ${section('Exemplo de conteúdo comercial', cat.copy)}
      ${!cat.campos && !cat.ficha && !cat.copy ? '<div class="exemplos-empty"><span style="font-size:28px;opacity:.3">📝</span><p>Esta categoria ainda não tem exemplos configurados.</p></div>' : ''}
    `;
  },

  _esc_html(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },

  close() {
    this._activeCat = null;
    document.getElementById('exemplosModalOverlay')?.remove();
    document.removeEventListener('keydown', this._esc);
  },

  _esc(e) { if (e.key === 'Escape') ExemplosModal.close(); },
};
