/**
 * components/CategoryModal.js
 */
import { AppState }   from './state.js';
import { Categories } from './categories.js';
import { SidebarUI }  from './SidebarUI.js';
import { Utils }      from './index.js';
import { APP_CONFIG } from './config.js';

const $ = id => document.getElementById(id);

export const CategoryModal = {
  open(id) {
    this.close(true);
    const cat = Categories.find(id);
    if (!cat) return;
    AppState.categories.active = id;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id        = 'catModalOverlay';
    overlay.innerHTML = `
      <div class="modal" id="catModal">
        <div class="modal-hdr">
          <span class="modal-title">✏️ Editar Categoria</span>
          <button class="modal-close" id="catModalCloseBtn">✕</button>
        </div>
        <div class="modal-body">
          <div class="m-field"><label>Nome</label>
            <input type="text" id="catNome" value="${Utils.escHtml(cat.nome || '')}" placeholder="Ex: Disjuntor, Ar-Condicionado..."/></div>
          <div class="m-field"><label>Campos prioritários</label>
            <textarea id="catCampos" placeholder="Ex: Corrente nominal, Grau IP...">${Utils.escHtml(cat.campos || '')}</textarea></div>
          <div class="m-field"><label>Exemplo de ficha ideal</label>
            <textarea id="catFicha" class="tall" placeholder="Cole uma ficha formatada como referência...">${Utils.escHtml(cat.ficha || '')}</textarea></div>
          <div class="m-field"><label>Exemplo de conteúdo comercial</label>
            <textarea id="catCopy" placeholder="Cole um exemplo de descrição + keyword + meta...">${Utils.escHtml(cat.copy || '')}</textarea></div>
        </div>
        <div class="modal-ftr">
          <button class="btn btn-danger" id="catModalDelBtn">🗑 Excluir</button>
          <span class="modal-saved" id="catSavedMsg">✓ salvo</span>
          <button class="btn btn-primary" id="catModalSaveBtn">✓ Concluir e Salvar</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) this.close(); });
    $('catModalCloseBtn').addEventListener('click', () => this.close());
    $('catModalSaveBtn').addEventListener('click',  () => this._finish());
    $('catModalDelBtn').addEventListener('click',   () => this._delete(id));
    ['catNome','catCampos','catFicha','catCopy'].forEach(fid => $(fid)?.addEventListener('input', () => this._autoSave()));
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

  _autoSave() {
    clearTimeout(AppState.categories.saveTimer);
    AppState.categories.saveTimer = setTimeout(async () => {
      const id = AppState.categories.active;
      const f  = { nome: $('catNome')?.value, campos: $('catCampos')?.value, ficha: $('catFicha')?.value, copy: $('catCopy')?.value };
      if (f.nome === undefined) return;
      await Categories.update(id, { nome: f.nome||'Sem nome', campos:f.campos||'', ficha:f.ficha||'', copy:f.copy||'' });
      const btn = document.querySelector(`.sb-cat-item[data-catid="${CSS.escape(id)}"] .sb-cat-name`);
      if (btn) btn.textContent = f.nome || 'Sem nome';
      const sv = $('catSavedMsg');
      if (sv) { sv.classList.add('show'); setTimeout(() => sv.classList.remove('show'), 1800); }
      SidebarUI.updateIndicator();
    }, APP_CONFIG.autoSaveDelay);
  },

  async _finish() {
    clearTimeout(AppState.categories.saveTimer); AppState.categories.saveTimer = null;
    const id   = AppState.categories.active;
    const nome = $('catNome')?.value.trim() || 'Sem nome';
    await Categories.update(id, { nome, campos:$('catCampos')?.value||'', ficha:$('catFicha')?.value||'', copy:$('catCopy')?.value||'' });
    AppState.categories.editorOpen = false;
    AppState.categories.active     = null;
    this.close(true); SidebarUI.render();
    Utils.showToast(`✓ "${nome}" salvo com sucesso`);
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
