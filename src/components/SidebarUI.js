/**
 * components/SidebarUI.js
 */
import { AppState }     from '../modules/state.js';
import { Categories }   from '../modules/categories.js';
import { Utils }        from '../utils/index.js';
import { hasCategoryDefinition } from '../modules/categoryQaSchema.js';

const $ = id => document.getElementById(id);

let _CategoryModal = null;
async function getCategoryModal() {
  if (!_CategoryModal) {
    const m = await import('./CategoryModal.js');
    _CategoryModal = m.CategoryModal;
  }
  return _CategoryModal;
}

export const SidebarUI = {
  _lastFingerprint: '',

  render() {
    const cats = Categories.getAll();
    const sbContent = $('sbContent');
    const sbFooter = $('sbFooter');
    if (!sbContent) return;

    if (AppState.categories.active && !cats.find(c => c.id === AppState.categories.active)) {
      AppState.categories.active = cats.length ? cats[0].id : null;
    }

    const fp = cats.map(c => `${c.id}:${c.nome}:${hasCategoryDefinition(c)}`).join('|') + '|' + AppState.categories.active;
    if (fp === this._lastFingerprint) {
      this.updateIndicator();
      return;
    }
    this._lastFingerprint = fp;

    if (cats.length === 0) {
      sbContent.innerHTML = `<div class="sb-empty"><strong>CAT</strong>Nenhuma categoria ainda.<br>Clique em <strong>Nova Categoria</strong> para começar.</div>`;
      if (sbFooter) sbFooter.textContent = '';
    } else {
      const items = cats.map(cat => {
        const isActive = cat.id === AppState.categories.active ? ' active' : '';
        const check = hasCategoryDefinition(cat) ? '<span class="sb-cat-check">✓</span>' : '';
        return `<button class="sb-cat-item${isActive}" data-catid="${Utils.escHtml(cat.id)}">
          <span class="sb-cat-dot"></span>
          <span class="sb-cat-name">${Utils.escHtml(cat.nome || 'Sem nome')}</span>
          ${check}
        </button>`;
      }).join('');
      sbContent.innerHTML = `<div class="sb-section-label">Categorias</div><div class="sb-cat-list">${items}</div>`;
      const total = cats.length;
      const withEx = cats.filter(hasCategoryDefinition).length;
      if (sbFooter) sbFooter.textContent = `${total} categoria${total > 1 ? 's' : ''} - ${withEx} com estrutura`;
    }
    this.updateIndicator();
  },

  updateIndicator() {
    const cats = Categories.getAll().filter(hasCategoryDefinition);
    const el = $('learnIndicator');
    const txt = $('learnIndicatorText');
    if (!el || !txt) return;
    if (cats.length === 0) {
      el.className = 'learn-indicator empty';
      txt.textContent = 'Nenhuma categoria estruturada - abra Categorias para adicionar referências';
    } else {
      el.className = 'learn-indicator';
      txt.textContent = `${cats.length} categoria${cats.length > 1 ? 's' : ''} estruturada${cats.length > 1 ? 's' : ''} ativa${cats.length > 1 ? 's' : ''}`;
    }
  },

  async select(id) {
    AppState.categories.active = id;
    AppState.categories.editorOpen = true;
    this.render();
    const CM = await getCategoryModal();
    CM.open(id);
  },
};
