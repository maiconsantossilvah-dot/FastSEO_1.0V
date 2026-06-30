/**
 * components/CategoryModal.js
 * Modal legado de categoria usado pela sidebar antiga.
 */
import { AppState }   from '../modules/state.js';
import { Categories } from '../modules/categories.js';
import { SidebarUI }  from './SidebarUI.js';
import { Utils }      from '../utils/index.js';
import { APP_CONFIG } from '../config.js';
import {
  fieldListToText,
  normalizeCategory,
  textToFieldList,
} from '../modules/categoryQaSchema.js';

const $ = id => document.getElementById(id);

export const CategoryModal = {
  open(id) {
    this.close(true);
    const rawCat = Categories.find(id);
    if (!rawCat) return;
    const cat = normalizeCategory(rawCat);
    AppState.categories.active = id;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'catModalOverlay';
    overlay.innerHTML = `
      <div class="modal" id="catModal">
        <div class="modal-hdr">
          <span class="modal-title">Editar Categoria</span>
          <button class="modal-close" id="catModalCloseBtn">x</button>
        </div>
        <div class="modal-body">
          <div class="m-field"><label>Nome</label>
            <input type="text" id="catNome" value="${Utils.escHtml(cat.nome || '')}" placeholder="Ex: Disjuntor, Ar-Condicionado..."/></div>
          <div class="m-field"><label>Campos obrigatórios</label>
            <textarea id="catCamposObrigatorios" placeholder="Ex: EAN, Marca, Tensão...">${Utils.escHtml(fieldListToText(cat.camposObrigatorios))}</textarea></div>
          <div class="m-field"><label>Campos opcionais</label>
            <textarea id="catCamposOpcionais" placeholder="Ex: Cor, Peso, Dimensões...">${Utils.escHtml(fieldListToText(cat.camposOpcionais))}</textarea></div>
          <div class="m-field"><label>Ficha ideal</label>
            <textarea id="catFichaIdeal" class="tall" placeholder="Cole a estrutura ideal desta categoria...">${Utils.escHtml(cat.fichaIdeal || '')}</textarea></div>
        </div>
        <div class="modal-ftr">
          <button class="btn btn-danger" id="catModalDelBtn">Excluir</button>
          <span class="modal-saved" id="catSavedMsg">salvo</span>
          <button class="btn btn-primary" id="catModalSaveBtn">Concluir e Salvar</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) this.close(); });
    $('catModalCloseBtn').addEventListener('click', () => this.close());
    $('catModalSaveBtn').addEventListener('click', () => this._finish());
    $('catModalDelBtn').addEventListener('click', () => this._delete(id));
    ['catNome','catCamposObrigatorios','catCamposOpcionais','catFichaIdeal'].forEach(fid => $(fid)?.addEventListener('input', () => this._autoSave()));
    document.addEventListener('keydown', this._escHandler);
    setTimeout(() => { const el = $('catNome'); if (el) { el.focus(); el.select(); } }, 50);
  },

  close(skipRender = false) {
    $('catModalOverlay')?.remove();
    document.removeEventListener('keydown', this._escHandler);
    AppState.categories.editorOpen = false;
    if (!skipRender) SidebarUI.render();
  },

  _escHandler(e) { if (e.key === 'Escape') CategoryModal.close(); },

  _readForm() {
    return {
      nome: $('catNome')?.value || 'Sem nome',
      camposObrigatorios: textToFieldList($('catCamposObrigatorios')?.value || ''),
      camposOpcionais: textToFieldList($('catCamposOpcionais')?.value || ''),
      fichaIdeal: $('catFichaIdeal')?.value || '',
    };
  },

  _autoSave() {
    clearTimeout(AppState.categories.saveTimer);
    AppState.categories.saveTimer = setTimeout(async () => {
      const id = AppState.categories.active;
      const data = this._readForm();
      if (data.nome === undefined) return;
      await Categories.update(id, { ...data, nome: data.nome || 'Sem nome' });
      const btn = document.querySelector(`.sb-cat-item[data-catid="${CSS.escape(id)}"] .sb-cat-name`);
      if (btn) btn.textContent = data.nome || 'Sem nome';
      const sv = $('catSavedMsg');
      if (sv) { sv.classList.add('show'); setTimeout(() => sv.classList.remove('show'), 1800); }
      SidebarUI.updateIndicator();
    }, APP_CONFIG.autoSaveDelay);
  },

  async _finish() {
    clearTimeout(AppState.categories.saveTimer); AppState.categories.saveTimer = null;
    const id = AppState.categories.active;
    const data = this._readForm();
    const nome = data.nome.trim() || 'Sem nome';
    await Categories.update(id, { ...data, nome });
    AppState.categories.editorOpen = false;
    AppState.categories.active = null;
    this.close(true); SidebarUI.render();
    Utils.showToast(`"${nome}" salvo com sucesso`);
  },

  async _delete(id) {
    if (!confirm('Excluir esta categoria?')) return;
    clearTimeout(AppState.categories.saveTimer); AppState.categories.saveTimer = null;
    this.close(true);
    await Categories.delete(id);
    AppState.categories.active = null; AppState.categories.editorOpen = false;
    SidebarUI.render();
  },
};
