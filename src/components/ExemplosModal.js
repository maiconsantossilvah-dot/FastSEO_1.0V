/**
 * components/ExemplosModal.js
 * Exibe a estrutura cadastrada por categoria.
 */

import { Categories } from '../modules/categories.js';
import {
  fieldListToText,
  hasCategoryDefinition,
  normalizeCategory,
} from '../modules/categoryQaSchema.js';

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
          <span class="modal-title">Estrutura por Categoria</span>
          <button class="modal-close" id="exemplosModalClose">x</button>
        </div>
        <div class="exemplos-layout">
          <div class="exemplos-sidebar" id="exemplosSidebar"></div>
          <div class="exemplos-content" id="exemplosContent">
            <div class="exemplos-empty">
              <span style="font-size:28px;opacity:.3">CAT</span>
              <p>Selecione uma categoria para ver a estrutura</p>
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
      const hasContent = hasCategoryDefinition(c);
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

    if (!this._activeCat) {
      const first = cats.find(hasCategoryDefinition) || cats[0];
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
    const rawCat = Categories.find(catId);
    if (!rawCat) return;
    const cat = normalizeCategory(rawCat);

    const section = (label, value) => {
      const text = Array.isArray(value) ? fieldListToText(value) : value;
      return text ? `
        <div class="exemplos-section">
          <div class="exemplos-section-label">${label}</div>
          <pre class="exemplos-section-body">${this._esc_html(text)}</pre>
        </div>` : '';
    };

    content.innerHTML = `
      <div class="exemplos-cat-header">
        <span class="exemplos-cat-title">${this._esc_html(cat.nome || 'Sem nome')}</span>
      </div>
      ${section('Campos obrigatorios', cat.camposObrigatorios)}
      ${section('Campos opcionais', cat.camposOpcionais)}
      ${section('Ficha ideal', cat.fichaIdeal)}
      ${section('JSON de validacao', JSON.stringify(cat.qaSchema, null, 2))}
      ${!hasCategoryDefinition(cat) ? '<div class="exemplos-empty"><span style="font-size:28px;opacity:.3">CAT</span><p>Esta categoria ainda nao tem estrutura configurada.</p></div>' : ''}
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
