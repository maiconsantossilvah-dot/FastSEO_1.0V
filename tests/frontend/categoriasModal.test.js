// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  canManage: true,
  update: vi.fn(async () => {}),
  appState: {
    categories: { active: null, editorOpen: false },
    setActiveCategory(id) { this.categories.active = id; },
  },
  categories: [{
    id: 'celular', nome: 'Celular', status: 'draft', profileType: 'technical', parentId: null,
    aliases: ['smartphone'], negativeTerms: [], camposObrigatorios: ['Marca'], camposOpcionais: ['Cor'],
    fichaIdeal: 'FICHA', avisoFichaTipo: 'normal', titleRule: { formula: 'Marca + Modelo', example: '' },
    modifiers: [], schemaVersion: 2, revision: 1, source: 'manual',
  }],
}));

vi.mock('../../src/modules/categories.js', () => ({
  Categories: {
    getEditable: () => mocks.categories,
    getAll: () => mocks.categories,
    find: id => mocks.categories.find(category => category.id === id) || null,
    update: mocks.update,
    create: vi.fn(), delete: vi.fn(), publish: vi.fn(),
    previewLegacyMigration: vi.fn(), migrateLegacy: vi.fn(), exportBackup: vi.fn(),
    previewImport: vi.fn(), importBatch: vi.fn(),
  },
}));
vi.mock('../../src/modules/state.js', () => ({ AppState: mocks.appState }));
vi.mock('../../src/services/userAccess.js', () => ({
  UserAccess: { can: () => mocks.canManage },
}));
vi.mock('../../src/services/api.js', () => ({ callGemini: vi.fn() }));
vi.mock('../../src/modules/quota.js', () => ({ Quota: { add: vi.fn() } }));
vi.mock('../../src/modules/aiRuntimeEvents.js', () => ({ createProviderEventHandler: () => vi.fn() }));

const { CategoriasModal } = await import('../../src/components/CategoriasModal.js');

describe('CategoriasModal controller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.canManage = true;
    mocks.appState.categories.active = null;
    mocks.appState.categories.editorOpen = false;
    document.body.innerHTML = '';
  });

  afterEach(() => {
    CategoriasModal.close();
    vi.runAllTimers();
    vi.useRealTimers();
  });

  it('abre a lista, seleciona a categoria e salva o draft com debounce', async () => {
    CategoriasModal.open();
    document.querySelector('.cats-item')?.click();
    const name = document.getElementById('catEditNome');

    expect(name).not.toBeNull();
    expect(mocks.appState.categories.active).toBe('celular');
    name.value = 'Celulares';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(700);

    expect(mocks.update).toHaveBeenCalledWith('celular', expect.objectContaining({ nome: 'Celulares' }));
  });

  it('remove ações de mutação e desabilita o editor sem permissão', () => {
    mocks.canManage = false;
    mocks.appState.categories.active = 'celular';
    CategoriasModal.open();

    expect(document.querySelector('.cats-btn-del')).toBeNull();
    expect(document.getElementById('catsAddBtn').hidden).toBe(true);
    expect(document.getElementById('catEditNome').disabled).toBe(true);
    expect(document.getElementById('catPublishBtn')).toBeNull();
  });
});
