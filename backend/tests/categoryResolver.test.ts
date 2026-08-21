import { describe, expect, it } from 'vitest';
import { resolveCategory } from '../src/categories/categoryResolver.js';
import type { CategoryProfile } from '../src/categories/types.js';

function profile(overrides: Partial<CategoryProfile>): CategoryProfile {
  return {
    id: 'garrafa', name: 'Garrafa', status: 'published', profileType: 'compact', parentId: null,
    aliases: ['squeeze', 'cantil'], negativeTerms: ['suporte para garrafa', 'refil para garrafa'],
    requiredFields: ['Capacidade'], optionalFields: ['Material'], idealSheet: '', sheetNoticeType: 'normal',
    titleRule: { formula: 'Produto + Marca + Capacidade', example: '' },
    modifiers: [{
      id: 'termica', name: 'Térmica', aliases: ['isotérmica', 'conserva temperatura', 'isolamento térmico'],
      negativeTerms: [], addRequiredFields: [], addOptionalFields: ['Tempo de conservação', 'Material interno'], titleSuffix: '',
    }],
    qaSchema: null, schemaVersion: 2, revision: 1, source: 'manual',
    ...overrides,
  };
}

describe('resolvedor de categorias', () => {
  it('identifica família e modificador mesmo quando térmica aparece fora do título', () => {
    const result = resolveCategory('Garrafa Invicta 1L\nMaterial: inox\nPossui isolamento térmico', [profile({})], 4);
    expect(result?.family.id).toBe('garrafa');
    expect(result?.modifiers).toEqual([{ id: 'termica', name: 'Térmica' }]);
    expect(result?.compiledProfile.optionalFields).toContain('Tempo de conservação');
    expect(result?.catalogVersion).toBe(4);
  });

  it('não força o modificador térmico em uma garrafa comum', () => {
    const result = resolveCategory('Garrafa de vidro 1L com tampa azul', [profile({})]);
    expect(result?.family.id).toBe('garrafa');
    expect(result?.modifiers).toEqual([]);
    expect(result?.compiledProfile.optionalFields).not.toContain('Tempo de conservação');
  });

  it('não classifica acessórios e refis como a família principal', () => {
    expect(resolveCategory('Suporte para garrafa térmica de bicicleta', [profile({})])).toBeNull();
    expect(resolveCategory('Refil para garrafa térmica', [profile({})])).toBeNull();
  });

  it('aplica campos herdados da categoria pai', () => {
    const parent = profile({ id: 'utilidades', name: 'Utilidades', aliases: ['utilitário'], requiredFields: ['Marca'] });
    const child = profile({ parentId: 'utilidades', requiredFields: ['Capacidade'] });
    const result = resolveCategory('Garrafa 1L', [parent, child]);
    expect(result?.compiledProfile.requiredFields).toEqual(expect.arrayContaining(['Marca', 'Capacidade']));
  });
});
