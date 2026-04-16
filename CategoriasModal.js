/**
 * components/CategoriasModal.js
 * ──────────────────────────────
 * Modal completo de gerenciamento de categorias.
 * Substitui a sidebar lateral — lista, cria, edita e exclui categorias.
 */

import { Categories } from './categories.js';
import { AppState }   from './state.js';

const $ = id => document.getElementById(id);

export const CategoriasModal = {
  _editingId: null,
  _saveTimer: null,

  open() {
    if ($('categoriasModalOverlay')) { this._render(); return; }

    const overlay = document.createElement('div');
    overlay.id = 'categoriasModalOverlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal modal--cats">
        <div class="modal-hdr">
          <span class="modal-title">🧠 Categorias de Referência</span>
          <button class="modal-close" id="catsModalClose">✕</button>
        </div>

        <div class="cats-layout">
          <!-- Coluna esquerda: lista -->
          <div class="cats-list-col">
            <div class="cats-search-row">
              <input type="text" id="catsBusca" placeholder="Buscar categoria..." autocomplete="off"/>
              <button class="btn btn-primary" id="catsAddBtn" style="white-space:nowrap;padding:7px 14px;font-size:12px">＋ Nova</button>
            </div>
            <div class="cats-list" id="catsList"></div>
            <div class="cats-list-footer" id="catsFooter"></div>
          </div>

          <!-- Coluna direita: editor -->
          <div class="cats-editor-col" id="catsEditor">
            <div class="cats-editor-empty">
              <span style="font-size:32px;opacity:.2">🧠</span>
              <p>Selecione ou crie uma categoria para editar</p>
            </div>
          </div>
        </div>

        <div class="modal-ftr" style="justify-content:flex-end">
          <span class="modal-saved" id="catsSavedMsg">✓ Salvo</span>
          <button class="btn btn-primary" id="catsModalClose2">Fechar</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    $('catsBusca')?.addEventListener('input', () => this._render());
    $('catsAddBtn')?.addEventListener('click', () => this._createNew());

    const close = () => this.close();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    $('catsModalClose')?.addEventListener('click', close);
    $('catsModalClose2')?.addEventListener('click', close);
    document.addEventListener('keydown', this._escHandler);

    this._render();
    // Abrir editor da categoria ativa se houver
    if (AppState.categories.active) this._openEditor(AppState.categories.active);
  },

  _render() {
    const list = $('catsList');
    const footer = $('catsFooter');
    if (!list) return;

    const query = ($('catsBusca')?.value || '').toLowerCase().trim();
    const all   = Categories.getAll();
    const cats  = query ? all.filter(c => (c.nome||'').toLowerCase().includes(query)) : all;

    if (!cats.length) {
      list.innerHTML = `<div class="cats-empty">${query ? 'Nenhuma categoria encontrada' : 'Nenhuma categoria ainda — crie a primeira!'}</div>`;
    } else {
      list.innerHTML = cats.map(c => {
        const hasEx = !!(c.ficha || c.campos || c.copy);
        const active = AppState.categories.active === c.id;
        return `<div class="cats-item${active ? ' active' : ''}" data-id="${c.id}">
          <span class="cats-item-dot" style="background:${hasEx ? '#4ade80' : 'rgba(255,255,255,.2)'}${hasEx ? ';box-shadow:0 0 6px rgba(74,222,128,.4)' : ''}"></span>
          <span class="cats-item-name">${this._esc(c.nome || 'Sem nome')}</span>
          <div class="cats-item-actions">
            <button class="cats-btn-edit" data-id="${c.id}" title="Editar">✏️</button>
            <button class="cats-btn-del"  data-id="${c.id}" title="Excluir">🗑️</button>
          </div>
        </div>`;
      }).join('');

      list.querySelectorAll('.cats-item').forEach(el => {
        el.addEventListener('click', e => {
          if (e.target.closest('.cats-item-actions')) return;
          AppState.categories.active = el.dataset.id;
          this._render();
          this._openEditor(el.dataset.id);
        });
      });
      list.querySelectorAll('.cats-btn-edit').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); this._openEditor(btn.dataset.id); });
      });
      list.querySelectorAll('.cats-btn-del').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); this._delete(btn.dataset.id); });
      });
    }

    if (footer) footer.textContent = `${all.length} categoria${all.length !== 1 ? 's' : ''} · ${all.filter(c=>c.ficha||c.campos||c.copy).length} com exemplos`;
  },

  _openEditor(id) {
    const col = $('catsEditor');
    if (!col) return;
    const cat = Categories.find(id);
    if (!cat) return;

    AppState.categories.active = id;
    this._editingId = id;
    this._render(); // atualiza item ativo na lista

    col.innerHTML = `
      <div class="cats-editor-form">
        <div class="cats-editor-hdr">
          <input class="cats-nome-input" id="catEditNome" type="text" value="${this._esc(cat.nome || '')}" placeholder="Nome da categoria" autocomplete="off"/>
        </div>
        <div class="cats-field">
          <label>Campos prioritários <span class="cats-field-hint">— liste os campos que o A1 deve priorizar</span></label>
          <textarea id="catEditCampos" rows="4" placeholder="Ex: EAN, Marca, Tensão, Potência...">${this._esc(cat.campos || '')}</textarea>
        </div>
        <div class="cats-field">
          <label>Exemplo de ficha ideal <span class="cats-field-hint">— referência para o formatador</span></label>
          <textarea id="catEditFicha" rows="6" placeholder="Cole aqui um exemplo de ficha bem formatada...">${this._esc(cat.ficha || '')}</textarea>
        </div>
        <div class="cats-field">
          <label>Exemplo de conteúdo comercial <span class="cats-field-hint">— referência para o copywriter</span></label>
          <textarea id="catEditCopy" rows="5" placeholder="Cole aqui um exemplo de descrição comercial...">${this._esc(cat.copy || '')}</textarea>
        </div>
      </div>`;

    // Auto-save em todos os campos
    ['catEditNome','catEditCampos','catEditFicha','catEditCopy'].forEach(fieldId => {
      $(fieldId)?.addEventListener('input', () => this._scheduleSave());
    });
  },

  _scheduleSave() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._save(), 700);
  },

  async _save() {
    const id = this._editingId;
    if (!id) return;
    const nome   = $('catEditNome')?.value.trim()   || '';
    const campos = $('catEditCampos')?.value || '';
    const ficha  = $('catEditFicha')?.value  || '';
    const copy   = $('catEditCopy')?.value   || '';
    await Categories.update(id, { nome, campos, ficha, copy });
    this._showSaved();
    // Disparar re-render global para outros módulos
    document.dispatchEvent(new CustomEvent('fastseo:catsChanged'));
  },

  async _createNew() {
    const nova = await Categories.create();
    AppState.categories.active = nova.id;
    this._render();
    this._openEditor(nova.id);
    // Focar no nome
    setTimeout(() => { $('catEditNome')?.focus(); $('catEditNome')?.select(); }, 50);
  },

  async _delete(id) {
    const cat = Categories.find(id);
    if (!cat) return;
    if (!confirm(`Excluir a categoria "${cat.nome}"? Esta ação não pode ser desfeita.`)) return;
    await Categories.delete(id);
    if (AppState.categories.active === id) {
      AppState.categories.active = null;
      this._editingId = null;
      const col = $('catsEditor');
      if (col) col.innerHTML = `<div class="cats-editor-empty"><span style="font-size:32px;opacity:.2">🧠</span><p>Selecione ou crie uma categoria para editar</p></div>`;
    }
    this._render();
  },

  _showSaved() {
    const msg = $('catsSavedMsg');
    if (!msg) return;
    msg.classList.add('show');
    clearTimeout(this._savedTimer);
    this._savedTimer = setTimeout(() => msg.classList.remove('show'), 1800);
  },

  _esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },

  close() {
    clearTimeout(this._saveTimer);
    if (this._editingId) this._save();
    $('categoriasModalOverlay')?.remove();
    document.removeEventListener('keydown', this._escHandler);
  },

  _escHandler(e) { if (e.key === 'Escape') CategoriasModal.close(); },

  // Chamado pelo categories.js quando dados mudam (via evento)
  onCatsChanged() { this._render(); },
};
