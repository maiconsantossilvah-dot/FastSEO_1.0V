import { describe, expect, it } from 'vitest';
import { convertLegacyCatalog } from '../src/categories/legacyMigration.js';

describe('migração do catálogo legado', () => {
  it('combina categoria e regra de título sem publicar automaticamente', () => {
    const [result] = convertLegacyCatalog([
      { nome: 'Garrafa', camposObrigatorios: ['Capacidade'], fichaIdeal: 'CAPACIDADE\nMARCA' },
    ], [
      { nome: 'Garrafa', formula: 'Produto + Marca + Capacidade', ex: 'Garrafa Invicta 1L' },
    ]);
    expect(result).toMatchObject({
      id: 'garrafa', status: 'draft', source: 'legacy-migration', requiredFields: ['Capacidade'],
      titleRule: { formula: 'Produto + Marca + Capacidade', example: 'Garrafa Invicta 1L' },
    });
  });

  it('sugere herança quando existe uma categoria mais específica', () => {
    const results = convertLegacyCatalog([
      { nome: 'Garrafa', camposObrigatorios: ['Capacidade'] },
      { nome: 'Garrafa Térmica', camposOpcionais: ['Tempo de conservação'] },
    ], []);
    expect(results.find(item => item.id === 'garrafa-termica')?.parentId).toBe('garrafa');
  });

  it('preserva regras de título que ainda não possuem categoria', () => {
    const results = convertLegacyCatalog([], [{ nome: 'Prego', formula: 'Produto + Medida', ex: '' }]);
    expect(results[0]).toMatchObject({ id: 'prego', name: 'Prego', status: 'draft' });
  });
});
