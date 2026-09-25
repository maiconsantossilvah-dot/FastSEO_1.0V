import { describe, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => {
  const categoriesGet = vi.fn(async () => ({
    docs: [{ id: 'celular-legado', data: () => ({ nome: 'Celular', camposObrigatorios: ['Marca'] }) }],
  }));
  const subcategoriesGet = vi.fn(async () => ({ docs: [] }));
  const transactionGet = vi.fn(async (reference: { kind: string }) => {
    if (reference.kind === 'published') return { docs: [] };
    if (reference.kind === 'meta') return { data: () => ({ version: 7 }) };
    throw new Error(`Referência inesperada no teste: ${reference.kind}`);
  });
  const runTransaction = vi.fn(async callback => callback({ get: transactionGet }));
  const adminDb = {
    runTransaction,
    collection: vi.fn((name: string) => {
      if (name === 'categoryCatalogPublished') return { kind: 'published' };
      if (name === 'categoryCatalog') return { doc: () => ({ kind: 'meta' }) };
      if (name === 'categories') return { get: categoriesGet };
      if (name === 'subcategories') return { get: subcategoriesGet };
      return { doc: vi.fn(), get: vi.fn() };
    }),
  };
  return { adminDb, categoriesGet, subcategoriesGet, runTransaction };
});

vi.mock('../src/firebaseAdmin.js', () => ({ adminDb: firestore.adminDb }));

const { resolvePublishedCategory } = await import('../src/categories/categories.service.js');

describe('cache operacional do catálogo de categorias', () => {
  it('compartilha uma única leitura entre resoluções concorrentes e reutiliza o resultado', async () => {
    const concurrent = await Promise.all(Array.from(
      { length: 6 },
      () => resolvePublishedCategory('Celular Samsung Galaxy'),
    ));
    const cached = await resolvePublishedCategory('Celular Motorola');

    expect(concurrent.every(result => result.resolution?.family.id === 'celular')).toBe(true);
    expect(cached.resolution?.family.id).toBe('celular');
    expect(firestore.runTransaction).toHaveBeenCalledOnce();
    expect(firestore.categoriesGet).toHaveBeenCalledOnce();
    expect(firestore.subcategoriesGet).toHaveBeenCalledOnce();
  });
});
