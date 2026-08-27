const STORAGE = {
  ficha: 'fastseo_draft_ficha',
  compiler: 'fastseo_draft_compiler',
};

function safeGet(key, fallback = '') {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // O rascunho é uma conveniência; falhas de armazenamento não bloqueiam o app.
  }
}

/** Persiste somente os campos de trabalho que podem ser recuperados localmente. */
export function createDraftStorage({
  getElement = id => document.getElementById(id),
  debounceMs = 450,
} = {}) {
  let draftTimer = null;
  let initialized = false;

  function save() {
    const input = getElement('inputText');
    if (input) safeSet(STORAGE.ficha, input.value);

    const compiler = {};
    document.querySelectorAll('[data-compiler-field]').forEach(field => {
      compiler[field.id] = field.value;
    });
    safeSet(STORAGE.compiler, JSON.stringify(compiler));

    const status = getElement('draftStatus');
    if (status) {
      status.textContent = 'Rascunho salvo';
      window.setTimeout(() => {
        if (status.textContent === 'Rascunho salvo') status.textContent = '';
      }, 1800);
    }
  }

  function scheduleSave() {
    window.clearTimeout(draftTimer);
    draftTimer = window.setTimeout(save, debounceMs);
  }

  function restore() {
    const input = getElement('inputText');
    const fichaDraft = safeGet(STORAGE.ficha);
    if (input && !input.value && fichaDraft) {
      input.value = fichaDraft;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    try {
      const compilerDraft = JSON.parse(safeGet(STORAGE.compiler, '{}'));
      Object.entries(compilerDraft).forEach(([id, value]) => {
        const field = getElement(id);
        if (field && !field.value) field.value = String(value ?? '');
      });
    } catch {
      // Rascunho inválido é ignorado sem impedir a inicialização.
    }
  }

  function init() {
    if (initialized) return;
    initialized = true;
    getElement('inputText')?.addEventListener('input', scheduleSave);
    document.querySelectorAll('[data-compiler-field]').forEach(field => {
      field.addEventListener('input', scheduleSave);
    });
    restore();
  }

  function clearCompilerDraft() {
    safeSet(STORAGE.compiler, '{}');
  }

  return { init, save, restore, clearCompilerDraft };
}

