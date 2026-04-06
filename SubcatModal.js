/**
 * components/SubcatModal.js
 * Modal de padronização de títulos (subcategorias).
 */
import { SubcatModule, SUBCAT_RULES_DEFAULT } from '../modules/subcategories.js';
import { Utils } from '../utils/index.js';

const $ = id => document.getElementById(id);
let _search = '';
let _editingNome = null;

export const SubcatModal = {
  open() {
    if ($('subcatModalOverlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay modal-overlay--prompt';
    overlay.id = 'subcatModalOverlay';
    overlay.innerHTML = `
      <div class="modal modal--lg" style="max-width:700px">
        <div class="modal-hdr">
          <span class="modal-title">📐 Padronização de Títulos</span>
          <button class="modal-close" id="subcatCloseBtn">✕</button>
        </div>
        <div class="modal-body" style="gap:12px">
          <div style="font-size:12px;color:var(--color-text-secondary);line-height:1.6;">
            Regras usadas pelo <strong>Agente A1</strong> para gerar títulos SEO no padrão correto.
            Personalize fórmulas e exemplos ou adicione novas regras para categorias específicas.
          </div>
          <div class="subcat-toolbar">
            <input type="text" class="subcat-search" id="subcatSearch" placeholder="Filtrar por nome de categoria..." value="${Utils.escHtml(_search)}"/>
            <span class="subcat-count" id="subcatCount"></span>
            <button class="btn btn-ghost" id="subcatResetBtn" style="font-size:11px">↺ Restaurar padrão</button>
          </div>
          <div class="subcat-list" id="subcatList"></div>
          <button class="btn btn-ghost" id="subcatAddToggleBtn" style="align-self:flex-start;font-size:12px">＋ Nova regra</button>
          <div class="subcat-add-panel" id="subcatAddPanel">
            <div class="sf-row"><label>Nome da categoria</label>
              <input type="text" id="subcatAddNome" placeholder="Ex: Fritadeira Elétrica"/></div>
            <div class="sf-row"><label>Fórmula do título</label>
              <textarea id="subcatAddFormula" placeholder="produto + Marca + Modelo + Características + Cor + Voltagem"></textarea></div>
            <div class="sf-row"><label>Exemplo (opcional)</label>
              <textarea id="subcatAddEx" placeholder="Fritadeira Airfryer Mondial AF-55I 5,5 Litros Preta 110V"></textarea></div>
            <div class="subcat-add-panel-btns">
              <button class="btn btn-secondary" id="subcatAddCancelBtn">Cancelar</button>
              <button class="btn btn-primary"   id="subcatAddSaveBtn">Adicionar regra</button>
            </div>
          </div>
        </div>
        <div class="modal-ftr" style="justify-content:flex-end">
          <button class="btn btn-primary" id="subcatCloseBtnFtr">Fechar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) this.close(); });
    $('subcatCloseBtn').addEventListener('click',    () => this.close());
    $('subcatCloseBtnFtr').addEventListener('click', () => this.close());
    $('subcatSearch').addEventListener('input', e => { _search = e.target.value; this._render(); });
    $('subcatResetBtn').addEventListener('click', () => this._resetAll());
    $('subcatAddToggleBtn').addEventListener('click', () => this._toggleAddPanel());
    $('subcatAddCancelBtn').addEventListener('click', () => this._closeAddPanel());
    $('subcatAddSaveBtn').addEventListener('click',   () => this._saveNew());
    document.addEventListener('keydown', this._escHandler);
    this._render();
  },

  close() {
    _editingNome = null;
    $('subcatModalOverlay')?.remove();
    document.removeEventListener('keydown', this._escHandler);
  },
  _escHandler(e) { if (e.key === 'Escape') SubcatModal.close(); },

  _render() {
    const list  = $('subcatList');
    const count = $('subcatCount');
    if (!list) return;
    const all  = SubcatModule.getAll();
    const term = _search.toLowerCase().trim();
    const filtered = term ? all.filter(r => r.nome.toLowerCase().includes(term) || r.formula.toLowerCase().includes(term)) : all;
    if (count) count.textContent = `${filtered.length} de ${all.length} regras`;

    list.innerHTML = filtered.map(rule => {
      const isEditing = _editingNome === rule.nome;
      const isCustom  = SubcatModule.getAll().find(r=>r.nome===rule.nome) && !SUBCAT_RULES_DEFAULT.some(d=>d.nome===rule.nome&&d.formula===rule.formula);
      const customTag = isCustom ? '<span class="subcat-custom-tag">custom</span>' : '';
      if (isEditing) {
        return `<div class="subcat-row editing" data-nome="${Utils.escHtml(rule.nome)}">
          <div>
            <div class="subcat-edit-form open">
              <div class="sf-row"><label>Nome</label><input type="text" class="ef-nome" value="${Utils.escHtml(rule.nome)}"/></div>
              <div class="sf-row"><label>Fórmula</label><textarea class="ef-formula">${Utils.escHtml(rule.formula)}</textarea></div>
              <div class="sf-row"><label>Exemplo</label><textarea class="ef-ex">${Utils.escHtml(rule.ex||'')}</textarea></div>
              <div class="subcat-edit-btns">
                <button class="btn btn-secondary sc-cancel-btn">Cancelar</button>
                <button class="btn btn-primary sc-save-btn">Salvar</button>
              </div>
            </div>
          </div>
          <div class="subcat-actions">
            <button class="btn btn-icon sc-del-btn" title="Excluir">🗑</button>
          </div>
        </div>`;
      }
      return `<div class="subcat-row" data-nome="${Utils.escHtml(rule.nome)}">
        <div>
          <div class="subcat-nome">${Utils.escHtml(rule.nome)}${customTag}</div>
          <div class="subcat-formula">${Utils.escHtml(rule.formula)}</div>
          ${rule.ex ? `<div class="subcat-ex">Ex: ${Utils.escHtml(rule.ex)}</div>` : ''}
        </div>
        <div class="subcat-actions">
          <button class="btn btn-icon sc-edit-btn" title="Editar">✏️</button>
          <button class="btn btn-icon sc-del-btn"  title="Excluir">🗑</button>
        </div>
      </div>`;
    }).join('');

    list.querySelectorAll('.sc-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => { _editingNome = btn.closest('[data-nome]').dataset.nome; this._render(); });
    });
    list.querySelectorAll('.sc-cancel-btn').forEach(btn => {
      btn.addEventListener('click', () => { _editingNome = null; this._render(); });
    });
    list.querySelectorAll('.sc-save-btn').forEach(btn => {
      btn.addEventListener('click', () => this._saveEdit(btn.closest('[data-nome]')));
    });
    list.querySelectorAll('.sc-del-btn').forEach(btn => {
      btn.addEventListener('click', () => this._delete(btn.closest('[data-nome]').dataset.nome));
    });

    if (_editingNome) {
      const row = list.querySelector('.subcat-row.editing');
      if (row) setTimeout(() => row.scrollIntoView({ behavior:'smooth', block:'nearest' }), 50);
    }
  },

  async _saveEdit(row) {
    const nome    = row.dataset.nome;
    const newNome = row.querySelector('.ef-nome')?.value.trim();
    const formula = row.querySelector('.ef-formula')?.value.trim();
    const ex      = row.querySelector('.ef-ex')?.value.trim();
    if (!newNome) { alert('O nome da subcategoria não pode estar vazio.'); return; }
    if (!formula) { alert('A fórmula do título não pode estar vazia.'); return; }
    await SubcatModule.upsert(nome, { nome:newNome, formula, ex:ex||'' });
    _editingNome = null;
    Utils.showToast(`✓ "${newNome}" salvo`);
    this._render();
  },

  async _delete(nome) {
    if (!confirm(`Excluir a regra "${nome}"?`)) return;
    await SubcatModule.delete(nome);
    if (_editingNome === nome) _editingNome = null;
    Utils.showToast(`🗑 "${nome}" removido`);
    this._render();
  },

  _toggleAddPanel() {
    const panel = $('subcatAddPanel');
    if (!panel) return;
    const isOpen = panel.classList.contains('open');
    if (isOpen) { this._closeAddPanel(); }
    else {
      panel.classList.add('open');
      $('subcatAddToggleBtn').textContent = '✕ Cancelar';
      setTimeout(() => $('subcatAddNome')?.focus(), 50);
    }
  },

  _closeAddPanel() {
    const panel = $('subcatAddPanel');
    if (!panel) return;
    panel.classList.remove('open');
    $('subcatAddToggleBtn').textContent = '＋ Nova regra';
    ['subcatAddNome','subcatAddFormula','subcatAddEx'].forEach(id => { const el=$(id); if(el) el.value=''; });
  },

  async _saveNew() {
    const nome    = $('subcatAddNome')?.value.trim();
    const formula = $('subcatAddFormula')?.value.trim();
    const ex      = $('subcatAddEx')?.value.trim() || '';
    if (!nome)    { alert('Informe o nome da subcategoria.'); return; }
    if (!formula) { alert('Informe a fórmula do título.'); return; }
    if (SubcatModule.getAll().some(r => r.nome.toLowerCase() === nome.toLowerCase())) {
      alert(`Já existe uma regra com o nome "${nome}". Edite a existente.`); return;
    }
    await SubcatModule.upsert(nome, { nome, formula, ex });
    this._closeAddPanel();
    _search = ''; const s=$('subcatSearch'); if(s) s.value='';
    Utils.showToast(`✓ "${nome}" adicionado`);
    this._render();
  },

  async _resetAll() {
    const count = SubcatModule.countCustom();
    if (count === 0) { alert('Nenhuma customização para restaurar.'); return; }
    if (!confirm(`Isso irá desfazer todas as ${count} customização(ões) e restaurar as regras padrão. Continuar?`)) return;
    await SubcatModule.resetAll();
    _editingNome = null;
    Utils.showToast('↺ Regras padrão restauradas');
    this._render();
  },
};
