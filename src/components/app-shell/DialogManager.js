/**
 * Centraliza acessibilidade, ícones e restauração de foco dos modais criados
 * dinamicamente. Não conhece regras de negócio de nenhum modal específico.
 */
export function createDialogManager({ refreshIcons = () => {} } = {}) {
  let lastTrigger = null;
  let initialized = false;

  function rememberTrigger(element) {
    lastTrigger = element instanceof HTMLElement ? element : null;
  }

  function decorate(overlay) {
    if (overlay.dataset.uiDecorated === 'true') return;
    overlay.dataset.uiDecorated = 'true';

    const dialog = overlay.querySelector('.modal');
    const title = dialog?.querySelector('.modal-title');
    if (!dialog) return;
    document.body.classList.add('has-dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    if (title) {
      if (!title.id) title.id = `${overlay.id || 'fastseo'}Title`;
      dialog.setAttribute('aria-labelledby', title.id);
    }

    dialog.querySelectorAll('.modal-close').forEach(button => {
      button.innerHTML = '<i data-lucide="x" aria-hidden="true"></i>';
      button.setAttribute('aria-label', 'Fechar');
      button.setAttribute('title', 'Fechar');
    });
    dialog.querySelectorAll('[title="Editar"]').forEach(button => {
      button.innerHTML = '<i data-lucide="pencil" aria-hidden="true"></i>';
      button.setAttribute('aria-label', 'Editar');
    });
    dialog.querySelectorAll('[title="Excluir"]').forEach(button => {
      button.innerHTML = '<i data-lucide="trash-2" aria-hidden="true"></i>';
      button.setAttribute('aria-label', 'Excluir');
    });

    const search = dialog.querySelector('input[placeholder*="🔍"]');
    if (search) search.placeholder = search.placeholder.replace('🔍', '').trim();
    requestAnimationFrame(() => {
      if (!overlay.isConnected) return;
      const target = dialog.querySelector('input:not([type="hidden"]), textarea, button');
      target?.focus({ preventScroll: true });
    });
  }

  function observe() {
    const observer = new MutationObserver(mutations => {
      let hasNewIcons = false;
      let modalRemoved = false;

      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (!(node instanceof HTMLElement)) return;
          const overlays = node.matches('.modal-overlay') ? [node] : [...node.querySelectorAll('.modal-overlay')];
          overlays.forEach(decorate);
          if (node.matches('i[data-lucide]') || node.querySelector('i[data-lucide]')) hasNewIcons = true;
        });
        mutation.removedNodes.forEach(node => {
          if (node instanceof HTMLElement && node.matches('.modal-overlay')) modalRemoved = true;
        });
      });

      if (hasNewIcons) refreshIcons();
      if (!modalRemoved) return;
      const hasModal = Boolean(document.querySelector('.modal-overlay'));
      const palette = document.getElementById('commandPalette');
      const paletteOpen = Boolean(palette && !palette.hidden);
      document.body.classList.toggle('has-dialog', hasModal || paletteOpen);
      if (!hasModal && lastTrigger instanceof HTMLElement) {
        requestAnimationFrame(() => lastTrigger?.focus({ preventScroll: true }));
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    if (initialized) return;
    initialized = true;
    observe();
  }

  return { init, decorate, rememberTrigger };
}

