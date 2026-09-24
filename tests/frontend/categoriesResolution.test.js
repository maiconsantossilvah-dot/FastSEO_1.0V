// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCatalog: vi.fn(),
  resolve: vi.fn(),
}));

vi.mock('../../src/firebase/firestore.js', () => ({
  CategoriesDB: { listen: vi.fn() },
}));
vi.mock('../../src/services/userAccess.js', () => ({
  UserAccess: {
    isDegraded: () => false,
    can: () => false,
  },
}));
vi.mock('../../src/services/categoryCatalog.js', () => ({
  CategoryCatalogApi: {
    cachedCatalog: () => null,
    getCatalog: mocks.getCatalog,
    resolve: mocks.resolve,
    isUnavailable: () => false,
  },
}));

const { Categories } = await import('../../src/modules/categories.js');

describe('diagnóstico da resolução de categorias', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.getCatalog.mockResolvedValue({ version: 1, profiles: [] });
  });

  it('preserva a evidência informada pelo matcher', async () => {
    mocks.resolve.mockResolvedValue({
      resolution: {
        compiledProfile: {
          id: 'garrafa',
          nome: 'Garrafa',
          aliases: ['squeeze'],
          camposObrigatorios: [],
          camposOpcionais: [],
          fichaIdeal: '',
          titleRule: { formula: '', example: '' },
          modifiers: [],
        },
      },
      categoryMatch: {
        reason: 'MATCHED', confidence: 0.9, score: 122, runnerUpScore: 0, evidenceZone: 'title',
        evidence: ['squeeze'], evidenceKind: 'alias', candidate: { id: 'garrafa', name: 'Garrafa' },
        matcherVersion: 'title-identity-v2',
      },
      titleRule: null,
      productSource: { title: 'Squeeze esportiva 750 ml' },
      catalogVersion: 1,
    });

    const result = await Categories.resolveDetailed('Squeeze esportiva 750 ml');

    expect(result.categories).toHaveLength(1);
    expect(result.categoryMatch).toMatchObject({
      evidence: ['squeeze'], evidenceKind: 'alias', matcherVersion: 'title-identity-v2',
    });
  });

  it('rejeita falso positivo de backend antigo quando a evidência não está no título', async () => {
    mocks.resolve.mockResolvedValue({
      resolution: {
        compiledProfile: {
          id: 'saco',
          nome: 'Saco',
          aliases: [],
          camposObrigatorios: [],
          camposOpcionais: [],
          fichaIdeal: '',
          titleRule: { formula: '', example: '' },
          modifiers: [],
        },
        family: { id: 'saco', name: 'Saco' },
        evidence: ['Saco'],
      },
      categoryMatch: { reason: 'MATCHED', confidence: 0.9, score: 41, runnerUpScore: 0, evidenceZone: 'title' },
      titleRule: null,
      productSource: { title: 'LIQUIDO LUSTRADOR FINALIZADOR 3M PRETO 500ML' },
      catalogVersion: 1,
    });

    const result = await Categories.resolveDetailed('LIQUIDO LUSTRADOR FINALIZADOR 3M PRETO 500ML');

    expect(result.categories).toEqual([]);
    expect(result.categoryMatch).toMatchObject({
      reason: 'NO_IDENTITY_EVIDENCE',
      confidence: 0,
      evidence: ['Saco'],
      candidate: { id: 'saco', name: 'Saco' },
      matcherVersion: 'legacy-or-unknown',
      rejectedOutOfTitleEvidence: true,
    });
  });
});
