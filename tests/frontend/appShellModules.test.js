// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCommandPalette } from '../../src/components/app-shell/CommandPalette.js';
import { createDialogManager } from '../../src/components/app-shell/DialogManager.js';
import { createDraftStorage } from '../../src/components/app-shell/DraftStorage.js';

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <button id="launcher">Abrir</button>
      <button id="commandPaletteBtn">Comandos</button>
      <button id="targetA">Destino A</button>
      <button id="targetB" hidden>Destino B</button>
      <section id="commandPalette" hidden>
        <button data-command-close>Fechar</button>
        <input id="commandPaletteInput" />
        <div id="commandPaletteResults"></div>
      </section>`;
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('filtra comandos disponíveis, executa o destino e restaura o foco', () => {
    const refreshIcons = vi.fn();
    const target = document.getElementById('targetA');
    const onTarget = vi.fn();
    target.addEventListener('click', onTarget);
    document.getElementById('launcher').focus();

    const palette = createCommandPalette({
      commands: [
        { id: 'targetA', icon: 'file', label: 'Ficha', description: 'Gerar conteúdo', group: 'Trabalho' },
        { id: 'targetB', icon: 'users', label: 'Usuários', description: 'Gerenciar equipe', group: 'Admin' },
      ],
      refreshIcons,
    });
    palette.init();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));

    expect(palette.isOpen()).toBe(true);
    expect(document.querySelectorAll('.command-item')).toHaveLength(1);
    expect(document.body.classList.contains('has-dialog')).toBe(true);
    expect(refreshIcons).toHaveBeenCalled();

    document.querySelector('.command-item').click();
    expect(onTarget).toHaveBeenCalledOnce();
    expect(palette.isOpen()).toBe(false);
    expect(document.activeElement).toBe(document.getElementById('launcher'));
  });
});

describe('DraftStorage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    document.body.innerHTML = `
      <textarea id="inputText"></textarea>
      <input id="compilerTitle" data-compiler-field />
      <span id="draftStatus"></span>`;
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('restaura e salva os rascunhos com debounce', () => {
    localStorage.setItem('fastseo_draft_ficha', 'Ficha recuperada');
    localStorage.setItem('fastseo_draft_compiler', JSON.stringify({ compilerTitle: 'Título recuperado' }));
    const drafts = createDraftStorage();

    drafts.init();
    expect(document.getElementById('inputText').value).toBe('Ficha recuperada');
    expect(document.getElementById('compilerTitle').value).toBe('Título recuperado');

    document.getElementById('inputText').value = 'Nova ficha';
    document.getElementById('compilerTitle').value = 'Novo título';
    document.getElementById('compilerTitle').dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(450);

    expect(localStorage.getItem('fastseo_draft_ficha')).toBe('Nova ficha');
    expect(JSON.parse(localStorage.getItem('fastseo_draft_compiler'))).toEqual({ compilerTitle: 'Novo título' });
    expect(document.getElementById('draftStatus').textContent).toBe('Rascunho salvo');

    drafts.clearCompilerDraft();
    expect(localStorage.getItem('fastseo_draft_compiler')).toBe('{}');
  });
});

describe('DialogManager', () => {
  beforeEach(() => {
    document.body.innerHTML = '<button id="trigger">Abrir modal</button>';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('decora o modal com semântica e controles acessíveis', () => {
    const manager = createDialogManager();
    const overlay = document.createElement('section');
    overlay.id = 'usersModal';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h2 class="modal-title">Usuários</h2>
        <button class="modal-close">X</button>
        <button title="Editar">Editar</button>
        <button title="Excluir">Excluir</button>
        <input placeholder="🔍 Buscar" />
      </div>`;
    document.body.appendChild(overlay);

    manager.decorate(overlay);

    const dialog = overlay.querySelector('.modal');
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('usersModalTitle');
    expect(overlay.querySelector('.modal-close').getAttribute('aria-label')).toBe('Fechar');
    expect(overlay.querySelector('[title="Editar"] i').dataset.lucide).toBe('pencil');
    expect(overlay.querySelector('input').placeholder).toBe('Buscar');
    expect(document.body.classList.contains('has-dialog')).toBe(true);
  });
});

