/**
 * components/SidebarUI.js
 */
import { AppState }     from './state.js';
import { Categories }   from './categories.js';
import { Utils }        from './index.js';

const $ = id => document.getElementById(id);

// Lazy import to avoid circular dependency
let _CategoryModal = null;
async function getCategoryModal() {
  if (!_CategoryModal) {
    const m = await import('./CategoryModal.js');
    _CategoryModal = m.CategoryModal;
  }
  return _CategoryModal;
}

export const SidebarUI = {
  render() {
    const cats      = Categories.getAll();
    const sbContent = $('sbContent');
    const sbFooter  = $('sbFooter');
    if (!sbContent) return;

    if (AppState.categories.active && !cats.find(c => c.id === AppState.categories.active)) {
      AppState.categories.active = cats.length ? cats[0].id : null;
    }

    if (cats.length === 0) {
      sbContent.innerHTML = `<div class="sb-empty"><strong>📂</strong>Nenhuma categoria ainda.<br>Clique em <strong>＋ Nova Categoria</strong> para começar.</div>`;
      if (sbFooter) sbFooter.textContent = '';
    } else {
      const items = cats.map(cat => {
        const isActive = cat.id === AppState.categories.active ? ' active' : '';
        const check    = (cat.ficha || cat.campos || cat.copy) ? '<span class="sb-cat-check">✓</span>' : '';
        return `<button class="sb-cat-item${isActive}" data-catid="${Utils.escHtml(cat.id)}">
          <span class="sb-cat-dot"></span>
          <span class="sb-cat-name">${Utils.escHtml(cat.nome || 'Sem nome')}</span>
          ${check}
        </button>`;
      }).join('');
      sbContent.innerHTML = `<div class="sb-section-label">Categorias</div><div class="sb-cat-list">${items}</div>`;
      const total = cats.length, withEx = cats.filter(c => c.ficha || c.campos).length;
      if (sbFooter) sbFooter.textContent = `${total} categoria${total > 1 ? 's' : ''} · ${withEx} com exemplos`;
    }
    this.updateIndicator();
  },

  updateIndicator() {
    const cats = Categories.getAll().filter(c => c.ficha || c.campos || c.copy);
    const el   = $('learnIndicator'), txt = $('learnIndicatorText');
    if (!el || !txt) return;
    if (cats.length === 0) {
      el.className    = 'learn-indicator empty';
      txt.textContent = 'Nenhum exemplo configurado — abra o painel lateral para adicionar referências';
    } else {
      el.className    = 'learn-indicator';
      txt.textContent = `📚 ${cats.length} categoria${cats.length > 1 ? 's' : ''} de referência ativa${cats.length > 1 ? 's' : ''} — o modelo usará seus exemplos como guia`;
    }
  },

  async select(id) {
    AppState.categories.active     = id;
    AppState.categories.editorOpen = true;
    this.render();
    const CM = await getCategoryModal();
    CM.open(id);
  },
};
