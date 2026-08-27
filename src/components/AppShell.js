import { createCommandPalette } from './app-shell/CommandPalette.js';
import { createDialogManager } from './app-shell/DialogManager.js';
import { createDraftStorage } from './app-shell/DraftStorage.js';

const $ = id => document.getElementById(id);

const STORAGE = {
  sidebar: 'fastseo_sidebar_collapsed',
  admin: 'fastseo_admin_nav_open',
};

let iconRefreshQueued = false;
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

const commandPalette = createCommandPalette({ refreshIcons: queueIconRefresh });
const dialogManager = createDialogManager({ refreshIcons: queueIconRefresh });
const draftStorage = createDraftStorage();

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

function runPrimaryAction() {
  if (commandPalette.isOpen()) return;
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

function bindGlobalKeys() {
  document.addEventListener('keydown', event => {
    const meta = event.ctrlKey || event.metaKey;
    if (meta && event.key === 'Enter') {
      event.preventDefault();
      runPrimaryAction();
      return;
    }
    // A paleta trata seus próprios atalhos antes do shell.
    if (event.defaultPrevented) return;
    if (event.key === 'Escape' && document.body.classList.contains('sidebar-open')) closeSidebar();

    if (event.key === 'Tab') {
      const surface = (commandPalette.isOpen() && $('commandPalette'))
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
      if (button.id.startsWith('open')) dialogManager.rememberTrigger(button);
      if (window.matchMedia('(max-width: 1120px)').matches) closeSidebar();
    });
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

export const AppShell = {
  init() {
    if (initialized) return;
    initialized = true;
    const collapsed = safeGet(STORAGE.sidebar, 'false') === 'true';
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    $('sidebarCollapseBtn')?.setAttribute('aria-expanded', String(!collapsed));
    toggleAdminNav(safeGet(STORAGE.admin, 'true') !== 'false');
    bindShell();
    commandPalette.init();
    bindGlobalKeys();
    draftStorage.init();
    dialogManager.init();
    refreshIcons();
  },
  refreshIcons: queueIconRefresh,
  renderThemeIcon,
  closeSidebar,
  clearCompilerDraft: draftStorage.clearCompilerDraft,
};
