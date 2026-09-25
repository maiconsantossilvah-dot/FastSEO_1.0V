// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCatalog: vi.fn(),
  getProfiles: vi.fn(),
  update: vi.fn(),
  publish: vi.fn(),
}));

vi.mock('../../src/services/userAccess.js', () => ({
  UserAccess: {
    isDegraded: () => false,
    can: permission => permission === 'manageCategoryCatalog',
    assert: vi.fn(),
  },
}));

vi.mock('../../src/services/categoryCatalog.js', () => ({
  CategoryCatalogApi: {
    cachedCatalog: () => null,
    getCatalog: mocks.getCatalog,
    getProfiles: mocks.getProfiles,
    update: mocks.update,
    publish: mocks.publish,
    isUnavailable: () => false,
  },
}));

const { Categories } = await import('../../src/modules/categories.js');

function category(overrides = {}) {
  return {
    id: 'celular', nome: 'Celular', status: 'draft', profileType: 'technical', parentId: null,
    aliases: ['smartphone'], negativeTerms: [], camposObrigatorios: ['Marca'], camposOpcionais: ['Cor'],
    fichaIdeal: '', avisoFichaTipo: 'normal', titleRule: { formula: '', example: '' }, modifiers: [],
    schemaVersion: 2, revision: 1, source: 'manual',
    ...overrides,
  };
}

describe('orçamento de leituras do catálogo no frontend', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.getCatalog.mockResolvedValue({
      version: 3,
      profiles: [],
      legacyProfiles: [category({ status: 'legacy', source: 'legacy-migration' })],
    });
    mocks.getProfiles.mockResolvedValue({ profiles: [category()] });
    mocks.update.mockResolvedValue(category({ revision: 2 }));
    mocks.publish.mockResolvedValue({
      catalogVersion: 4,
      profile: category({ status: 'published', revision: 3, publishedVersion: 4 }),
    });
    await Categories.refresh();
  });

  it('não marca autosaves de rascunho como mudança da resolução', async () => {
    const details = [];
    const listener = event => details.push(event.detail);
    document.addEventListener('fastseo:catsChanged', listener);

    await Categories.update('celular', { nome: 'Celular atualizado' });
    document.removeEventListener('fastseo:catsChanged', listener);

    expect(details).toHaveLength(2);
    expect(details.every(detail => detail.affectsResolution === false)).toBe(true);
  });

  it('publica atualizando o cache incrementalmente, sem reler o catálogo completo', async () => {
    const catalogReadsBeforePublish = mocks.getCatalog.mock.calls.length;

    const published = await Categories.publish('celular');

    expect(published.status).toBe('published');
    expect(Categories.catalogVersion()).toBe(4);
    expect(Categories.getAll()).toContainEqual(expect.objectContaining({ id: 'celular', status: 'published' }));
    expect(mocks.getCatalog).toHaveBeenCalledTimes(catalogReadsBeforePublish);
    expect(mocks.getProfiles).toHaveBeenCalledOnce();
  });
});
