/**
 * modules/state.js
 * -----------------
 * Estado compartilhado entre módulos. Estados efêmeros e privados permanecem
 * dentro de seus componentes; somente contratos realmente cruzados vivem aqui.
 */

const activeCategoryListeners = new Set();

export const AppState = {
  pipeline: { running: false, result: {}, abort: null },
  pdfTexto: '',
  inputSource: '',
  categories: {
    active:     null,   // ID da categoria selecionada
    editorOpen: false,
    saveTimer:  null,
  },
  prompts: {
    activeTab: 'P1',
    saveTimer: null,
  },

  setActiveCategory(id) {
    const next = id || null;
    if (this.categories.active === next) return;
    this.categories.active = next;
    activeCategoryListeners.forEach(listener => listener(next));
  },

  onActiveCategoryChange(listener) {
    activeCategoryListeners.add(listener);
    return () => activeCategoryListeners.delete(listener);
  },

};

