/**
 * components/CategoriasModal.js
 * Modal completo de gerenciamento de categorias.
 * Mantém o cadastro que orienta exemplos, campos obrigatórios e validação do A2.
 */

import { Categories } from '../modules/categories.js';
import { AppState } from '../modules/state.js';
import {
  createQaSchemaFromCategory,
  fieldListToText,
  hasCategoryDefinition,
  normalizeCategory,
  textToFieldList,
} from '../modules/categoryQaSchema.js';
import { CATEGORY_NOTICE_OPTIONS } from '../modules/categoryNotices.js';
import { UserAccess } from '../services/userAccess.js';

const $ = id => document.getElementById(id);

export const CategoriasModal = {
  _editingId: null,
  _saveTimer: null,

  open() {
    if ($('categoriasModalOverlay')) { this._render(); return; }

    const canManage = UserAccess.can('manageCategoryCatalog');
    const overlay = document.createElement('div');
    overlay.id = 'categoriasModalOverlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal modal--cats">
        <div class="modal-hdr">
          <span class="modal-title"><i data-lucide="tags" aria-hidden="true"></i> Categorias de referência</span>
          <button class="modal-close" id="catsModalClose" type="button" aria-label="Fechar"><i data-lucide="x" aria-hidden="true"></i></button>
        </div>

        <div class="cats-layout">
          <div class="cats-list-col">
            <div class="cats-search-row">
              <input type="text" id="catsBusca" placeholder="Buscar categoria..." autocomplete="off"/>
              <button class="btn btn-primary" id="catsAddBtn" type="button"${canManage ? '' : ' hidden'}><i data-lucide="plus" aria-hidden="true"></i> Nova</button>
            </div>
            <div class="cats-list" id="catsList"></div>
            <div class="cats-list-footer" id="catsFooter"></div>
          </div>

          <div class="cats-editor-col" id="catsEditor">
            <div class="cats-editor-empty ui-empty-state">
              <i data-lucide="tags" aria-hidden="true"></i>
              <strong>Configure uma referência</strong>
              <p>Selecione uma categoria existente ou crie a primeira estrutura para orientar o pipeline.</p>
              <button class="btn btn-primary" id="catsEmptyAddBtn" type="button"${canManage ? '' : ' hidden'}><i data-lucide="plus" aria-hidden="true"></i> Criar categoria</button>
            </div>
          </div>
        </div>

        <div class="modal-ftr cats-catalog-footer">
          <div class="cats-catalog-actions"${canManage ? '' : ' hidden'}>
            <button class="btn btn-ghost" id="catsExportBtn" type="button"><i data-lucide="download" aria-hidden="true"></i> Backup</button>
            <button class="btn btn-ghost" id="catsMigrateBtn" type="button"><i data-lucide="database-backup" aria-hidden="true"></i> Migrar legado</button>
            <button class="btn btn-ghost" id="catsImportBtn" type="button"><i data-lucide="file-up" aria-hidden="true"></i> Importar JSON</button>
            <input id="catsImportFile" type="file" accept="application/json,.json" hidden/>
          </div>
          <span class="modal-saved" id="catsSavedMsg">Salvo</span>
          <button class="btn btn-primary" id="catsModalClose2">Fechar</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    $('catsBusca')?.addEventListener('input', () => this._render());
    $('catsAddBtn')?.addEventListener('click', () => this._createNew());
    $('catsEmptyAddBtn')?.addEventListener('click', () => this._createNew());
    $('catsMigrateBtn')?.addEventListener('click', () => this._migrateLegacy());
    $('catsExportBtn')?.addEventListener('click', () => this._exportBackup());
    $('catsImportBtn')?.addEventListener('click', () => $('catsImportFile')?.click());
    $('catsImportFile')?.addEventListener('change', event => this._importJson(event.target.files?.[0]));

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
    const all = UserAccess.can('manageCategoryCatalog') ? Categories.getEditable() : Categories.getAll();
    const cats = query ? all.filter(c => (c.nome || '').toLowerCase().includes(query)) : all;

    if (!cats.length) {
      list.innerHTML = `<div class="cats-empty">${query ? 'Nenhuma categoria encontrada' : 'Nenhuma categoria ainda - crie a primeira!'}</div>`;
    } else {
      list.innerHTML = cats.map(c => {
        const hasEx = hasCategoryDefinition(c);
        const active = AppState.categories.active === c.id;
        const status = c.status === 'draft' ? 'Rascunho' : c.status === 'archived' ? 'Arquivada' : 'Publicada';
        return `<div class="cats-item${active ? ' active' : ''}" data-id="${c.id}">
          <span class="cats-item-dot" style="background:${hasEx ? '#4ade80' : 'rgba(255,255,255,.2)'}${hasEx ? ';box-shadow:0 0 6px rgba(74,222,128,.4)' : ''}"></span>
          <span class="cats-item-name">${this._esc(c.nome || 'Sem nome')}</span>
          <span class="cats-status cats-status--${this._esc(c.status || 'published')}">${status}</span>
          <div class="cats-item-actions">
            <button class="cats-btn-edit" data-id="${c.id}" title="${UserAccess.can('manageCategoryCatalog') ? 'Editar' : 'Visualizar'}">${UserAccess.can('manageCategoryCatalog') ? 'Editar' : 'Ver'}</button>
            ${UserAccess.can('manageCategoryCatalog') ? `<button class="cats-btn-del" data-id="${c.id}" title="Arquivar">Arquivar</button>` : ''}
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
    const canManage = UserAccess.can('manageCategoryCatalog');
    const disabled = canManage ? '' : ' disabled';

    const noticeOptionsHtml = CATEGORY_NOTICE_OPTIONS.map(option => {
      const selected = (cat.avisoFichaTipo || 'normal') === option.key ? ' selected' : '';
      return `<option value="${this._esc(option.key)}"${selected}>${this._esc(option.label)}</option>`;
    }).join('');
    const parentOptions = Categories.getEditable()
      .filter(item => item.id !== id && item.status !== 'archived')
      .map(item => `<option value="${this._esc(item.id)}"${cat.parentId === item.id ? ' selected' : ''}>${this._esc(item.nome)}</option>`)
      .join('');

    AppState.categories.active = id;
    AppState.categories.editorOpen = true;
    this._editingId = id;
    this._render();

    col.innerHTML = `
      <div class="cats-editor-form">
        <div class="cats-editor-hdr">
          <input class="cats-nome-input" id="catEditNome" type="text" value="${this._esc(cat.nome || '')}" placeholder="Nome da categoria" autocomplete="off"${disabled}/>
          <div class="cats-publish-group">
            <span class="cats-status cats-status--${this._esc(cat.status || 'published')}">${cat.status === 'draft' ? 'Rascunho' : cat.status === 'archived' ? 'Arquivada' : 'Publicada'}</span>
            ${canManage && cat.status !== 'archived' ? '<button class="btn btn-primary" id="catPublishBtn" type="button"><i data-lucide="cloud-upload" aria-hidden="true"></i> Publicar</button>' : ''}
          </div>
        </div>
        <div class="cats-profile-grid">
          <div class="cats-field">
            <label>Tipo do perfil</label>
            <select id="catEditProfileType"${disabled}>
              <option value="compact"${cat.profileType === 'compact' ? ' selected' : ''}>Compacto</option>
              <option value="technical"${cat.profileType === 'technical' ? ' selected' : ''}>Técnico</option>
              <option value="generic"${cat.profileType === 'generic' ? ' selected' : ''}>Genérico</option>
            </select>
          </div>
          <div class="cats-field">
            <label>Herdar de</label>
            <select id="catEditParent"${disabled}><option value="">Nenhuma categoria</option>${parentOptions}</select>
          </div>
        </div>
        <div class="cats-field">
          <label>Aliases <span class="cats-field-hint">- sinônimos, singular e nomes comerciais</span></label>
          <textarea id="catEditAliases" rows="3" placeholder="Ex: squeeze, cantil, garrafinha"${disabled}>${this._esc(fieldListToText(cat.aliases || []))}</textarea>
        </div>
        <div class="cats-field">
          <label>Termos negativos <span class="cats-field-hint">- impedem falsos positivos</span></label>
          <textarea id="catEditNegativeTerms" rows="2" placeholder="Ex: suporte para garrafa, refil para garrafa"${disabled}>${this._esc(fieldListToText(cat.negativeTerms || []))}</textarea>
        </div>
        <div class="cats-field">
          <label>Campos obrigatórios <span class="cats-field-hint">- o A2 valida com mais rigor</span></label>
          <textarea id="catEditObrigatorios" rows="4" placeholder="Ex: EAN, Marca, Tensão, Potência..."${disabled}>${this._esc(fieldListToText(cat.camposObrigatorios))}</textarea>
        </div>
        <div class="cats-field">
          <label>Campos opcionais <span class="cats-field-hint">- validam se aparecerem nos dados brutos</span></label>
          <textarea id="catEditOpcionais" rows="4" placeholder="Ex: Cor, Peso, Dimensões, Recursos extras..."${disabled}>${this._esc(fieldListToText(cat.camposOpcionais))}</textarea>
        </div>

<div class="cats-field">
  <label>Texto obrigatório da ficha</label>
  <select id="catEditAvisoFicha"${disabled}>
    ${noticeOptionsHtml}
  </select>
</div>

        <div class="cats-field">
          <label>Ficha ideal <span class="cats-field-hint">- referência para o formatador</span></label>
          <textarea id="catEditFichaIdeal" rows="6" placeholder="Cole aqui a estrutura ideal desta categoria..."${disabled}>${this._esc(cat.fichaIdeal || '')}</textarea>
        </div>
        <div class="cats-profile-grid">
          <div class="cats-field">
            <label>Fórmula do título</label>
            <textarea id="catEditTitleFormula" rows="2" placeholder="Produto + Marca + Modelo + Característica"${disabled}>${this._esc(cat.titleRule?.formula || '')}</textarea>
          </div>
          <div class="cats-field">
            <label>Exemplo de título</label>
            <textarea id="catEditTitleExample" rows="2" placeholder="Garrafa Invicta 1L Inox"${disabled}>${this._esc(cat.titleRule?.example || '')}</textarea>
          </div>
        </div>
        <div class="cats-field">
          <div class="cats-section-heading">
            <label>Modificadores <span class="cats-field-hint">- complementam campos quando detectados</span></label>
            ${canManage ? '<button class="btn btn-ghost btn-sm" id="catAddModifierBtn" type="button"><i data-lucide="plus" aria-hidden="true"></i> Adicionar</button>' : ''}
          </div>
          <div class="cats-modifiers" id="catEditModifiers"></div>
        </div>
        <div class="cats-field">
          <label>JSON de validação <span class="cats-field-hint">- gerado automaticamente</span></label>
          <pre class="exemplos-section-body" id="catEditQaPreview"></pre>
        </div>
      </div>`;

    this._renderModifiers(cat.modifiers || [], canManage);
    ['catEditNome', 'catEditAliases', 'catEditNegativeTerms', 'catEditObrigatorios', 'catEditOpcionais', 'catEditFichaIdeal', 'catEditTitleFormula', 'catEditTitleExample'].forEach(fieldId => {

      $(fieldId)?.addEventListener('input', () => {
        this._updateQaPreview();
        this._scheduleSave();
      });
    });
    this._updateQaPreview();
    $('catEditAvisoFicha')?.addEventListener('change', () => {
      this._updateQaPreview();
      this._scheduleSave();
    });
    ['catEditProfileType', 'catEditParent'].forEach(fieldId => $(fieldId)?.addEventListener('change', () => this._scheduleSave()));
    $('catPublishBtn')?.addEventListener('click', () => this._publish());
    $('catAddModifierBtn')?.addEventListener('click', () => this._addModifier());
    $('catEditModifiers')?.addEventListener('input', () => this._scheduleSave());
    $('catEditModifiers')?.addEventListener('click', event => {
      const remove = event.target.closest('[data-remove-modifier]');
      if (remove) { remove.closest('.cat-modifier-row')?.remove(); this._scheduleSave(); }
    });
  },

  _scheduleSave() {
    if (!UserAccess.can('manageCategoryCatalog')) return;
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
      profileType: $('catEditProfileType')?.value || 'compact',
      parentId: $('catEditParent')?.value || null,
      aliases: textToFieldList($('catEditAliases')?.value || ''),
      negativeTerms: textToFieldList($('catEditNegativeTerms')?.value || ''),
      camposObrigatorios: textToFieldList($('catEditObrigatorios')?.value || ''),
      camposOpcionais: textToFieldList($('catEditOpcionais')?.value || ''),
      fichaIdeal: $('catEditFichaIdeal')?.value || '',
      avisoFichaTipo: $('catEditAvisoFicha')?.value || 'normal',
      titleRule: {
        formula: $('catEditTitleFormula')?.value || '',
        example: $('catEditTitleExample')?.value || '',
      },
      modifiers: [...document.querySelectorAll('#catEditModifiers .cat-modifier-row')].map((row, index) => ({
        id: row.dataset.id || `modificador-${index + 1}`,
        nome: row.querySelector('[data-mod-name]')?.value.trim() || `Modificador ${index + 1}`,
        aliases: textToFieldList(row.querySelector('[data-mod-aliases]')?.value || ''),
        negativeTerms: [],
        camposObrigatorios: [],
        camposOpcionais: textToFieldList(row.querySelector('[data-mod-fields]')?.value || ''),
        titleSuffix: '',
      })),
    };
  },

  _updateQaPreview() {
    const preview = $('catEditQaPreview');
    if (!preview) return;
    preview.textContent = JSON.stringify(createQaSchemaFromCategory(this._getEditorDraft()), null, 2);
  },

  _renderModifiers(modifiers, canManage) {
    const container = $('catEditModifiers');
    if (!container) return;
    if (!modifiers.length) {
      container.innerHTML = '<div class="cats-modifiers-empty">Nenhum modificador. Exemplo: Térmica pode adicionar campos somente quando for detectada.</div>';
      return;
    }
    container.innerHTML = modifiers.map((modifier, index) => `
      <div class="cat-modifier-row" data-id="${this._esc(modifier.id || `modificador-${index + 1}`)}">
        <input data-mod-name type="text" value="${this._esc(modifier.nome || modifier.name || '')}" placeholder="Nome: Térmica"${canManage ? '' : ' disabled'}/>
        <input data-mod-aliases type="text" value="${this._esc((modifier.aliases || []).join(', '))}" placeholder="Aliases: isotérmica, conserva temperatura"${canManage ? '' : ' disabled'}/>
        <input data-mod-fields type="text" value="${this._esc((modifier.camposOpcionais || modifier.addOptionalFields || []).join(', '))}" placeholder="Campos adicionais: tempo de conservação"${canManage ? '' : ' disabled'}/>
        ${canManage ? '<button class="btn btn-ghost btn-icon" data-remove-modifier type="button" title="Remover modificador"><i data-lucide="trash-2" aria-hidden="true"></i></button>' : ''}
      </div>`).join('');
  },

  _addModifier() {
    const existing = this._getEditorDraft().modifiers;
    existing.push({
      id: `modificador-${existing.length + 1}`,
      nome: '', aliases: [], negativeTerms: [], camposObrigatorios: [], camposOpcionais: [], titleSuffix: '',
    });
    this._renderModifiers(existing, true);
    $('catEditModifiers')?.querySelector('.cat-modifier-row:last-child [data-mod-name]')?.focus();
  },

  async _publish() {
    if (!this._editingId || !UserAccess.can('manageCategoryCatalog')) return;
    const button = $('catPublishBtn');
    if (button) button.disabled = true;
    try {
      clearTimeout(this._saveTimer);
      await this._save();
      await Categories.publish(this._editingId);
      this._render();
      this._openEditor(this._editingId);
      this._showSaved('Publicado');
    } catch (error) {
      alert(`Não foi possível publicar: ${error.message}`);
    } finally {
      if (button) button.disabled = false;
    }
  },

  async _migrateLegacy() {
    if (!UserAccess.can('manageCategoryCatalog')) return;
    const button = $('catsMigrateBtn');
    if (button) button.disabled = true;
    try {
      const preview = await Categories.previewLegacyMigration();
      const conflictText = preview.conflicts?.length ? `\n${preview.conflicts.length} conflito(s) precisam ser corrigidos.` : '';
      const confirmed = confirm(
        `Foram encontrados ${preview.total} perfis: ${preview.creates} novos e ${preview.updates} atualizações.${conflictText}\n\nImportar todos como rascunho? Nada será publicado automaticamente.`,
      );
      if (!confirmed || preview.conflicts?.length) return;
      await Categories.migrateLegacy();
      this._render();
      this._showSaved('Migração concluída');
    } catch (error) {
      alert(`Não foi possível migrar: ${error.message}`);
    } finally {
      if (button) button.disabled = false;
    }
  },

  async _exportBackup() {
    if (!UserAccess.can('manageCategoryCatalog')) return;
    try {
      const backup = await Categories.exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `fastseo-categorias-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      this._showSaved('Backup exportado');
    } catch (error) {
      alert(`Não foi possível exportar o backup: ${error.message}`);
    }
  },

  async _importJson(file) {
    if (!file || !UserAccess.can('manageCategoryCatalog')) return;
    try {
      const parsed = JSON.parse(await file.text());
      const categories = Array.isArray(parsed) ? parsed : parsed.profiles;
      if (!Array.isArray(categories) || !categories.length) throw new Error('O JSON deve conter uma lista de perfis.');
      const preview = await Categories.previewImport(categories);
      if (preview.conflicts?.length) throw new Error(`${preview.conflicts.length} conflito(s) encontrados no arquivo.`);
      if (!confirm(`Importar ${preview.total} perfil(is) como rascunho?`)) return;
      await Categories.importBatch(categories);
      this._render();
      this._showSaved('Importação concluída');
    } catch (error) {
      alert(`Não foi possível importar: ${error.message}`);
    } finally {
      if ($('catsImportFile')) $('catsImportFile').value = '';
    }
  },

  async _createNew() {
    if (!UserAccess.can('manageCategoryCatalog')) return;
    const nova = await Categories.create();
    AppState.categories.active = nova.id;
    this._render();
    this._openEditor(nova.id);
    setTimeout(() => { $('catEditNome')?.focus(); $('catEditNome')?.select(); }, 50);
  },

  async _delete(id) {
    if (!UserAccess.can('manageCategoryCatalog')) return;
    const cat = Categories.find(id);
    if (!cat) return;
    if (!confirm(`Arquivar a categoria "${cat.nome}"? A versão publicada deixará de ser usada.`)) return;
    await Categories.delete(id);
    if (AppState.categories.active === id) {
      AppState.categories.active = null;
      this._editingId = null;
      const col = $('catsEditor');
      if (col) col.innerHTML = `<div class="cats-editor-empty"><span style="font-size:32px;opacity:.2">CAT</span><p>Selecione ou crie uma categoria para editar</p></div>`;
    }
    this._render();
  },

  _showSaved(label = 'Salvo') {
    const msg = $('catsSavedMsg');
    if (!msg) return;
    msg.textContent = label;
    msg.classList.add('show');
    clearTimeout(this._savedTimer);
    this._savedTimer = setTimeout(() => msg.classList.remove('show'), 1800);
  },

  _esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
