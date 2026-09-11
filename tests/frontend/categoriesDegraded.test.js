// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listen: vi.fn(),
  getCatalog: vi.fn(),
}));

vi.mock('../../src/firebase/firestore.js', () => ({
  CategoriesDB: { listen: mocks.listen },
}));
vi.mock('../../src/services/userAccess.js', () => ({
  UserAccess: { isDegraded: () => true, can: () => false },
}));
vi.mock('../../src/services/categoryCatalog.js', () => ({
  CategoryCatalogApi: {
    cachedCatalog: () => null,
    getCatalog: mocks.getCatalog,
    isUnavailable: () => false,
  },
}));

const { Categories } = await import('../../src/modules/categories.js');

describe('Categorias no modo degradado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('não abre listeners nem consulta o catálogo remoto', async () => {
    const cleanup = Categories.startSync();
    const resolution = await Categories.resolveDetailed('Produto sem categoria');

    expect(mocks.listen).not.toHaveBeenCalled();
    expect(mocks.getCatalog).not.toHaveBeenCalled();
    expect(resolution).toMatchObject({ categories: [], titleRule: null, degraded: true });
    expect(cleanup).toBeTypeOf('function');
  });
});
