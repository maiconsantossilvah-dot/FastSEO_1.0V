/**
 * components/CategoriasModal.js
 * Modal completo de gerenciamento de categorias.
 * Mantém o cadastro que orienta exemplos, campos obrigatórios e validação do A2.
 */

import { Categories } from '../modules/categories.js';
import { AppState }   from '../modules/state.js';
import {
  createQaSchemaFromCategory,
  fieldListToText,
  hasCategoryDefinition,
  normalizeCategory,
  textToFieldList,
} from '../modules/categoryQaSchema.js';

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
          <span class="modal-title">Categorias de Referência</span>
          <button class="modal-close" id="catsModalClose">x</button>
        </div>

        <div class="cats-layout">
          <div class="cats-list-col">
            <div class="cats-search-row">
              <input type="text" id="catsBusca" placeholder="Buscar categoria..." autocomplete="off"/>
              <button class="btn btn-primary" id="catsAddBtn" style="white-space:nowrap;padding:7px 14px;font-size:12px">Nova</button>
            </div>
            <div class="cats-list" id="catsList"></div>
            <div class="cats-list-footer" id="catsFooter"></div>
          </div>

          <div class="cats-editor-col" id="catsEditor">
            <div class="cats-editor-empty">
              <span style="font-size:32px;opacity:.2">CAT</span>
              <p>Selecione ou crie uma categoria para editar</p>
            </div>
          </div>
        </div>

        <div class="modal-ftr" style="justify-content:flex-end">
          <span class="modal-saved" id="catsSavedMsg">Salvo</span>
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
    if (AppState.categories.active) this._openEditor(AppState.categories.active);
  },

  _render() {
    const list = $('catsList');
    const footer = $('catsFooter');
    if (!list) return;

    const query = ($('catsBusca')?.value || '').toLowerCase().trim();
    const all = Categories.getAll();
    const cats = query ? all.filter(c => (c.nome || '').toLowerCase().includes(query)) : all;

    if (!cats.length) {
      list.innerHTML = `<div class="cats-empty">${query ? 'Nenhuma categoria encontrada' : 'Nenhuma categoria ainda - crie a primeira!'}</div>`;
    } else {
      list.innerHTML = cats.map(c => {
        const hasEx = hasCategoryDefinition(c);
        const active = AppState.categories.active === c.id;
        return `<div class="cats-item${active ? ' active' : ''}" data-id="${c.id}">
          <span class="cats-item-dot" style="background:${hasEx ? '#4ade80' : 'rgba(255,255,255,.2)'}${hasEx ? ';box-shadow:0 0 6px rgba(74,222,128,.4)' : ''}"></span>
          <span class="cats-item-name">${this._esc(c.nome || 'Sem nome')}</span>
          <div class="cats-item-actions">
            <button class="cats-btn-edit" data-id="${c.id}" title="Editar">Editar</button>
            <button class="cats-btn-del" data-id="${c.id}" title="Excluir">Excluir</button>
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

    if (footer) footer.textContent = `${all.length} categoria${all.length !== 1 ? 's' : ''} - ${all.filter(hasCategoryDefinition).length} com estrutura`;
  },

  _openEditor(id) {
    const col = $('catsEditor');
    if (!col) return;
    const rawCat = Categories.find(id);
    if (!rawCat) return;
    const cat = normalizeCategory(rawCat);

    AppState.categories.active = id;
    AppState.categories.editorOpen = true;
    this._editingId = id;
    this._render();

    col.innerHTML = `
      <div class="cats-editor-form">
        <div class="cats-editor-hdr">
          <input class="cats-nome-input" id="catEditNome" type="text" value="${this._esc(cat.nome || '')}" placeholder="Nome da categoria" autocomplete="off"/>
        </div>
        <div class="cats-field">
          <label>Campos obrigatórios <span class="cats-field-hint">- o A2 valida com mais rigor</span></label>
          <textarea id="catEditObrigatorios" rows="4" placeholder="Ex: EAN, Marca, Tensão, Potência...">${this._esc(fieldListToText(cat.camposObrigatorios))}</textarea>
        </div>
        <div class="cats-field">
          <label>Campos opcionais <span class="cats-field-hint">- validam se aparecerem nos dados brutos</span></label>
          <textarea id="catEditOpcionais" rows="4" placeholder="Ex: Cor, Peso, Dimensões, Recursos extras...">${this._esc(fieldListToText(cat.camposOpcionais))}</textarea>
        </div>
        <div class="cats-field">
          <label>Ficha ideal <span class="cats-field-hint">- referência para o formatador</span></label>
          <textarea id="catEditFichaIdeal" rows="6" placeholder="Cole aqui a estrutura ideal desta categoria...">${this._esc(cat.fichaIdeal || '')}</textarea>
        </div>
        <div class="cats-field">
          <label>JSON de validação <span class="cats-field-hint">- gerado automaticamente</span></label>
          <pre class="exemplos-section-body" id="catEditQaPreview"></pre>
        </div>
      </div>`;

    ['catEditNome','catEditObrigatorios','catEditOpcionais','catEditFichaIdeal'].forEach(fieldId => {
      $(fieldId)?.addEventListener('input', () => {
        this._updateQaPreview();
        this._scheduleSave();
      });
    });
    this._updateQaPreview();
  },

  _scheduleSave() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._save(), 700);
  },

  async _save() {
    const id = this._editingId;
    if (!id) return;
    await Categories.update(id, this._getEditorDraft());
    this._showSaved();
  },

  _getEditorDraft() {
    return {
      nome: $('catEditNome')?.value.trim() || 'Sem nome',
      camposObrigatorios: textToFieldList($('catEditObrigatorios')?.value || ''),
      camposOpcionais: textToFieldList($('catEditOpcionais')?.value || ''),
      fichaIdeal: $('catEditFichaIdeal')?.value || '',
    };
  },

  _updateQaPreview() {
    const preview = $('catEditQaPreview');
    if (!preview) return;
    preview.textContent = JSON.stringify(createQaSchemaFromCategory(this._getEditorDraft()), null, 2);
  },

  async _createNew() {
    const nova = await Categories.create();
    AppState.categories.active = nova.id;
    this._render();
    this._openEditor(nova.id);
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
      if (col) col.innerHTML = `<div class="cats-editor-empty"><span style="font-size:32px;opacity:.2">CAT</span><p>Selecione ou crie uma categoria para editar</p></div>`;
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
    AppState.categories.editorOpen = false;
    $('categoriasModalOverlay')?.remove();
    document.removeEventListener('keydown', this._escHandler);
  },

  _escHandler(e) { if (e.key === 'Escape') CategoriasModal.close(); },

  onCatsChanged() { this._render(); },
};
