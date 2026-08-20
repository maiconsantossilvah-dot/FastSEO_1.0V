const $ = id => document.getElementById(id);

const STORAGE = {
  sidebar: 'fastseo_sidebar_collapsed',
  admin: 'fastseo_admin_nav_open',
  fichaDraft: 'fastseo_draft_ficha',
  compilerDraft: 'fastseo_draft_compiler',
};

const viewCommands = [
  { id: 'showFichaViewBtn', icon: 'file-text', label: 'Ficha técnica', description: 'Gerar e revisar conteúdo', group: 'Trabalho' },
  { id: 'showCompilerViewBtn', icon: 'notebook-tabs', label: 'Compilador de dados', description: 'Organizar fontes e gerar TXT', group: 'Trabalho' },
  { id: 'showFaqViewBtn', icon: 'messages-square', label: 'Criador de FAQ', description: 'Editar perguntas e copiar HTML', group: 'Trabalho' },
  { id: 'openHistoricoBtn', icon: 'history', label: 'Histórico', description: 'Consultar fichas geradas', group: 'Trabalho' },
  { id: 'openCategoriasBtn', icon: 'tags', label: 'Categorias', description: 'Editar referências e exemplos', group: 'Administração' },
  { id: 'openUsersBtn', icon: 'users-round', label: 'Usuários', description: 'Gerenciar acessos, cargos e status', group: 'Administração' },
  { id: 'openSubcatBtn', icon: 'list-filter', label: 'Padrões de títulos', description: 'Gerenciar regras por subcategoria', group: 'Administração' },
  { id: 'openPromptsBtn', icon: 'braces', label: 'Prompts', description: 'Editar instruções dos agentes', group: 'Administração' },
  { id: 'openConfigBtn', icon: 'key-round', label: 'APIs e modelos', description: 'Configurar chaves e modelos', group: 'Administração' },
  { id: 'openAnalyticsBtn', icon: 'chart-no-axes-combined', label: 'Analytics', description: 'Ver métricas do pipeline', group: 'Administração' },
  { id: 'showDocsViewBtn', icon: 'book-open-text', label: 'Ajuda e documentação', description: 'Consultar regras do FastSEO', group: 'Ajuda' },
];

let commandItems = viewCommands;
let lastFocused = null;
let lastModalTrigger = null;
let iconRefreshQueued = false;
let draftTimer = null;
let sidebarFocusFrame = null;
let initialized = false;

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
    // A aplicação continua utilizável quando o armazenamento está indisponível.
  }
}

function refreshIcons() {
  if (!window.lucide?.createIcons || !document.querySelector('i[data-lucide]')) return;
  window.lucide.createIcons({
    attrs: {
      'aria-hidden': 'true',
      focusable: 'false',
    },
  });
}

function queueIconRefresh() {
  if (iconRefreshQueued) return;
  iconRefreshQueued = true;
  requestAnimationFrame(() => {
    iconRefreshQueued = false;
    refreshIcons();
  });
}

function closeSidebar() {
  if (sidebarFocusFrame !== null) {
    cancelAnimationFrame(sidebarFocusFrame);
    sidebarFocusFrame = null;
  }
  document.body.classList.remove('sidebar-open');
  $('sidebarBackdrop')?.setAttribute('hidden', '');
  $('sidebarMenuBtn')?.setAttribute('aria-expanded', 'false');
}

function openSidebar({ focusFirstItem = false } = {}) {
  if (document.body.classList.contains('sidebar-open')) return;
  document.body.classList.add('sidebar-open');
  $('sidebarBackdrop')?.removeAttribute('hidden');
  $('sidebarMenuBtn')?.setAttribute('aria-expanded', 'true');
  if (!focusFirstItem) return;
  sidebarFocusFrame = requestAnimationFrame(() => {
    sidebarFocusFrame = null;
    if (!document.body.classList.contains('sidebar-open')) return;
    $('appSidebar')?.querySelector('.app-nav-item')?.focus({ preventScroll: true });
  });
}

function toggleSidebarCollapse() {
  const collapsed = document.body.classList.toggle('sidebar-collapsed');
  safeSet(STORAGE.sidebar, String(collapsed));
  const button = $('sidebarCollapseBtn');
  button?.setAttribute('aria-expanded', String(!collapsed));
  button?.setAttribute('aria-label', collapsed ? 'Expandir navegação' : 'Recolher navegação');
}

function toggleAdminNav(force) {
  const toggle = $('adminNavToggle');
  const group = $('adminNavItems');
  if (!toggle || !group) return;

  const current = toggle.getAttribute('aria-expanded') === 'true';
  const open = typeof force === 'boolean' ? force : !current;
  toggle.setAttribute('aria-expanded', String(open));
  group.hidden = !open;
  safeSet(STORAGE.admin, String(open));
}

function updatePageContext(button) {
  if (!button?.dataset.viewTitle) return;
  const title = $('currentViewTitle');
  const description = $('currentViewDescription');
  if (title) title.textContent = button.dataset.viewTitle;
  if (description) description.textContent = button.dataset.viewDescription || '';
  document.title = `${button.dataset.viewTitle} — FastSEO`;
  closeSidebar();
}

function commandTemplate(command, index) {
  return `<button class="command-item${index === 0 ? ' is-active' : ''}" type="button" role="option"
    aria-selected="${index === 0}" data-command-id="${command.id}">
    <span class="command-item__icon"><i data-lucide="${command.icon}"></i></span>
    <span><strong>${command.label}</strong><small>${command.description}</small></span>
    <small>${command.group}</small>
  </button>`;
}

function renderCommands(query = '') {
  const results = $('commandPaletteResults');
  if (!results) return;
  const normalized = query.trim().toLocaleLowerCase('pt-BR');
  commandItems = viewCommands.filter(command => {
    const target = $(command.id);
    if (!target || target.hidden) return false;
    const content = `${command.label} ${command.description} ${command.group}`.toLocaleLowerCase('pt-BR');
    return !normalized || content.includes(normalized);
  });

  results.innerHTML = commandItems.length
    ? commandItems.map(commandTemplate).join('')
    : '<div class="command-empty">Nenhuma ferramenta encontrada.</div>';
  queueIconRefresh();
}

function openCommandPalette() {
  const palette = $('commandPalette');
  if (!palette) return;
  lastFocused = document.activeElement;
  palette.hidden = false;
  document.body.classList.add('has-dialog');
  renderCommands('');
  const input = $('commandPaletteInput');
  if (input) {
    input.value = '';
    window.setTimeout(() => input.focus(), 40);
  }
}

function closeCommandPalette() {
  const palette = $('commandPalette');
  if (!palette || palette.hidden) return;
  palette.hidden = true;
  document.body.classList.remove('has-dialog');
  if (lastFocused instanceof HTMLElement) lastFocused.focus();
}

function runCommand(id) {
  closeCommandPalette();
  $(id)?.click();
}

function moveCommandSelection(direction) {
  const items = [...document.querySelectorAll('.command-item')];
  if (!items.length) return;
  const current = Math.max(0, items.findIndex(item => item.classList.contains('is-active')));
  const next = (current + direction + items.length) % items.length;
  items.forEach((item, index) => {
    const active = index === next;
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-selected', String(active));
  });
  items[next].scrollIntoView({ block: 'nearest' });
}

function saveDrafts() {
  const input = $('inputText');
  if (input) safeSet(STORAGE.fichaDraft, input.value);

  const compiler = {};
  document.querySelectorAll('[data-compiler-field]').forEach(field => {
    compiler[field.id] = field.value;
  });
  safeSet(STORAGE.compilerDraft, JSON.stringify(compiler));

  const status = $('draftStatus');
  if (status) {
    status.textContent = 'Rascunho salvo';
    window.setTimeout(() => {
      if (status.textContent === 'Rascunho salvo') status.textContent = '';
    }, 1800);
  }
}

function scheduleDraftSave() {
  window.clearTimeout(draftTimer);
  draftTimer = window.setTimeout(saveDrafts, 450);
}

function restoreDrafts() {
  const input = $('inputText');
  const fichaDraft = safeGet(STORAGE.fichaDraft);
  if (input && !input.value && fichaDraft) {
    input.value = fichaDraft;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  try {
    const compilerDraft = JSON.parse(safeGet(STORAGE.compilerDraft, '{}'));
    Object.entries(compilerDraft).forEach(([id, value]) => {
      const field = $(id);
      if (field && !field.value) field.value = String(value ?? '');
    });
  } catch {
    // Rascunho inválido é ignorado sem impedir a inicialização.
  }
}

function runPrimaryAction() {
  if (!$('commandPalette')?.hidden) return;
  const activeElement = document.activeElement;
  if (activeElement?.closest?.('[role="dialog"]')) return;

  if (!$('faqWorkspace')?.hidden) {
    $('faqCopyHtml')?.click();
    return;
  }
  if (!$('compilerWorkspace')?.hidden) {
    $('compilerGenerateBtn')?.click();
    return;
  }
  if (!$('docsWorkspace')?.hidden) return;
  $('runBtn')?.click();
}

function bindCommandPalette() {
  $('commandPaletteBtn')?.addEventListener('click', openCommandPalette);
  $('commandPaletteInput')?.addEventListener('input', event => renderCommands(event.target.value));
  $('commandPaletteResults')?.addEventListener('click', event => {
    const item = event.target.closest('[data-command-id]');
    if (item) runCommand(item.dataset.commandId);
  });
  $('commandPalette')?.addEventListener('click', event => {
    if (event.target.matches('[data-command-close]')) closeCommandPalette();
  });
}

function bindGlobalKeys() {
  document.addEventListener('keydown', event => {
    const meta = event.ctrlKey || event.metaKey;
    if (meta && event.key.toLocaleLowerCase() === 'k') {
      event.preventDefault();
      openCommandPalette();
      return;
    }
    if (meta && event.key === 'Enter') {
      event.preventDefault();
      runPrimaryAction();
      return;
    }
    if (!$('commandPalette')?.hidden) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeCommandPalette();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveCommandSelection(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveCommandSelection(-1);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        document.querySelector('.command-item.is-active')?.click();
      }
      return;
    }
    if (event.key === 'Escape' && document.body.classList.contains('sidebar-open')) closeSidebar();

    if (event.key === 'Tab') {
      const surface = (!$('commandPalette')?.hidden && $('commandPalette'))
        || document.querySelector('.modal-overlay:last-of-type .modal');
      if (!surface) return;
      const focusable = [...surface.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
        .filter(element => !element.hidden && element.getClientRects().length);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
}

function bindShell() {
  document.querySelector('.app-brand')?.addEventListener('click', event => {
    event.preventDefault();
    $('showFichaViewBtn')?.click();
  });
  $('sidebarMenuBtn')?.addEventListener('click', event => {
    document.body.classList.contains('sidebar-open')
      ? closeSidebar()
      : openSidebar({ focusFirstItem: event.detail === 0 });
  });
  $('sidebarBackdrop')?.addEventListener('click', closeSidebar);
  $('sidebarCollapseBtn')?.addEventListener('click', toggleSidebarCollapse);
  $('adminNavToggle')?.addEventListener('click', () => toggleAdminNav());
  $('helpBtn')?.addEventListener('click', () => $('showDocsViewBtn')?.click());

  document.querySelectorAll('[data-view-title]').forEach(button => {
    button.addEventListener('click', () => updatePageContext(button));
  });

  document.querySelectorAll('.app-sidebar .app-nav-item').forEach(button => {
    button.title = button.querySelector('strong')?.textContent?.trim() || button.title;
    button.addEventListener('click', () => {
      if (button.id.startsWith('open')) lastModalTrigger = button;
      if (window.matchMedia('(max-width: 1120px)').matches) closeSidebar();
    });
  });
}

function bindDrafts() {
  $('inputText')?.addEventListener('input', scheduleDraftSave);
  document.querySelectorAll('[data-compiler-field]').forEach(field => field.addEventListener('input', scheduleDraftSave));
}

function observeDynamicUi() {
  const observer = new MutationObserver(mutations => {
    let hasNewIcons = false;
    let modalRemoved = false;

    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (!(node instanceof HTMLElement)) return;
        const overlays = node.matches('.modal-overlay') ? [node] : [...node.querySelectorAll('.modal-overlay')];
        overlays.forEach(decorateDialog);
        if (node.matches('i[data-lucide]') || node.querySelector('i[data-lucide]')) hasNewIcons = true;
      });
      mutation.removedNodes.forEach(node => {
        if (!(node instanceof HTMLElement) || !node.matches('.modal-overlay')) return;
        modalRemoved = true;
      });
    });

    if (hasNewIcons) queueIconRefresh();
    if (modalRemoved) {
      const hasModal = Boolean(document.querySelector('.modal-overlay'));
      const palette = $('commandPalette');
      const paletteOpen = Boolean(palette && !palette.hidden);
      document.body.classList.toggle('has-dialog', hasModal || paletteOpen);
      if (!hasModal && lastModalTrigger instanceof HTMLElement) {
        requestAnimationFrame(() => lastModalTrigger?.focus({ preventScroll: true }));
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function decorateDialog(overlay) {
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

function renderThemeIcon(mode) {
  const button = $('themeToggleBtn');
  if (!button) return;
  const isLight = mode === 'light';
  const icon = isLight ? 'moon' : 'sun';
  if (button.dataset.themeIcon !== icon) {
    button.dataset.themeIcon = icon;
    button.innerHTML = `<i data-lucide="${icon}" aria-hidden="true"></i>`;
  }
  button.title = isLight ? 'Mudar para tema escuro' : 'Mudar para tema claro';
  button.setAttribute('aria-label', button.title);
  queueIconRefresh();
}

function clearCompilerDraft() {
  safeSet(STORAGE.compilerDraft, '{}');
}

export const AppShell = {
  init() {
    if (initialized) return;
    initialized = true;
    const collapsed = safeGet(STORAGE.sidebar, 'false') === 'true';
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    $('sidebarCollapseBtn')?.setAttribute('aria-expanded', String(!collapsed));
    toggleAdminNav(safeGet(STORAGE.admin, 'true') !== 'false');
    bindShell();
    bindCommandPalette();
    bindGlobalKeys();
    bindDrafts();
    restoreDrafts();
    observeDynamicUi();
    refreshIcons();
  },
  refreshIcons: queueIconRefresh,
  renderThemeIcon,
  closeSidebar,
  clearCompilerDraft,
};
