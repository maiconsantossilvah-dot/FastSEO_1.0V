const DEFAULT_COMMANDS = [
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

/**
 * Controla a paleta de comandos e seu estado de foco sem conhecer o restante
 * do shell. Os comandos continuam apontando para os botões reais da aplicação.
 */
export function createCommandPalette({
  commands = DEFAULT_COMMANDS,
  getElement = id => document.getElementById(id),
  refreshIcons = () => {},
} = {}) {
  let commandItems = commands;
  let lastFocused = null;
  let initialized = false;

  function commandTemplate(command, index) {
    return `<button class="command-item${index === 0 ? ' is-active' : ''}" type="button" role="option"
      aria-selected="${index === 0}" data-command-id="${command.id}">
      <span class="command-item__icon"><i data-lucide="${command.icon}"></i></span>
      <span><strong>${command.label}</strong><small>${command.description}</small></span>
      <small>${command.group}</small>
    </button>`;
  }

  function render(query = '') {
    const results = getElement('commandPaletteResults');
    if (!results) return;
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    commandItems = commands.filter(command => {
      const target = getElement(command.id);
      if (!target || target.hidden) return false;
      const content = `${command.label} ${command.description} ${command.group}`.toLocaleLowerCase('pt-BR');
      return !normalized || content.includes(normalized);
    });

    results.innerHTML = commandItems.length
      ? commandItems.map(commandTemplate).join('')
      : '<div class="command-empty">Nenhuma ferramenta encontrada.</div>';
    refreshIcons();
  }

  function open() {
    const palette = getElement('commandPalette');
    if (!palette) return;
    lastFocused = document.activeElement;
    palette.hidden = false;
    document.body.classList.add('has-dialog');
    render('');
    const input = getElement('commandPaletteInput');
    if (input) {
      input.value = '';
      window.setTimeout(() => input.focus(), 40);
    }
  }

  function close() {
    const palette = getElement('commandPalette');
    if (!palette || palette.hidden) return;
    palette.hidden = true;
    document.body.classList.remove('has-dialog');
    if (lastFocused instanceof HTMLElement) lastFocused.focus();
  }

  function run(id) {
    close();
    getElement(id)?.click();
  }

  function moveSelection(direction) {
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

  function handleKeydown(event) {
    const meta = event.ctrlKey || event.metaKey;
    if (meta && event.key.toLocaleLowerCase() === 'k') {
      event.preventDefault();
      open();
      return;
    }
    if (meta || !isOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveSelection(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveSelection(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      document.querySelector('.command-item.is-active')?.click();
    }
  }

  function init() {
    if (initialized) return;
    initialized = true;
    getElement('commandPaletteBtn')?.addEventListener('click', open);
    getElement('commandPaletteInput')?.addEventListener('input', event => render(event.target.value));
    getElement('commandPaletteResults')?.addEventListener('click', event => {
      const item = event.target.closest('[data-command-id]');
      if (item) run(item.dataset.commandId);
    });
    getElement('commandPalette')?.addEventListener('click', event => {
      if (event.target.matches('[data-command-close]')) close();
    });
    document.addEventListener('keydown', handleKeydown);
  }

  function isOpen() {
    const palette = getElement('commandPalette');
    return Boolean(palette && !palette.hidden);
  }

  return { init, open, close, isOpen, render };
}

