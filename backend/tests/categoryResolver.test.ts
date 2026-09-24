import { describe, expect, it } from 'vitest';
import {
  createProductSource,
  resolveCategory,
  resolveCategoryDetailed,
} from '../src/categories/categoryResolver.js';
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

  it('seleciona a categoria própria do acessório sem herdar a família citada depois de para', () => {
    const suporte = profile({
      id: 'suporte-garrafa', name: 'Suporte para Garrafa', aliases: [], negativeTerms: [], modifiers: [],
    });

    expect(resolveCategory('Suporte para garrafa térmica de bicicleta', [profile({}), suporte])?.family.id)
      .toBe('suporte-garrafa');
  });

  it('aplica campos herdados da categoria pai', () => {
    const parent = profile({ id: 'utilidades', name: 'Utilidades', aliases: ['utilitário'], requiredFields: ['Marca'] });
    const child = profile({ parentId: 'utilidades', requiredFields: ['Capacidade'] });
    const result = resolveCategory('Garrafa 1L', [parent, child]);
    expect(result?.compiledProfile.requiredFields).toEqual(expect.arrayContaining(['Marca', 'Capacidade']));
  });

  it('não usa compatibilidade como evidência da família principal', () => {
    const notebook = profile({ id: 'notebook', name: 'Notebook', aliases: [], negativeTerms: [], modifiers: [] });
    const smartphone = profile({ id: 'smartphone', name: 'Smartphone', aliases: [], negativeTerms: [], modifiers: [] });

    expect(resolveCategory('Mouse sem fio\nCompatibilidade: notebook', [notebook])).toBeNull();
    expect(resolveCategory('Capa protetora compatível com smartphone Samsung', [smartphone])).toBeNull();
    expect(resolveCategory('Capa notebook Lenovo 15 polegadas', [notebook])).toBeNull();
  });

  it('aceita qualificador conhecido antes de uma categoria curta', () => {
    const tv = profile({ id: 'tv', name: 'TV', aliases: [], negativeTerms: [], modifiers: [] });

    expect(resolveCategory('Smart TV Samsung 55 polegadas', [tv])?.family.id).toBe('tv');
  });

  it('não usa categoria encontrada somente no corpo técnico', () => {
    const arCondicionado = profile({
      id: 'ar-condicionado', name: 'Ar Condicionado', aliases: [], negativeTerms: [], modifiers: [],
    });

    expect(resolveCategory('Controle remoto universal\nAplicação: ar condicionado split', [arCondicionado])).toBeNull();
  });

  it('não confunde uma característica de alimentação com o produto', () => {
    const bateria = profile({ id: 'bateria', name: 'Bateria', aliases: [], negativeTerms: [], modifiers: [] });

    expect(resolveCategory('Furadeira Bosch 20V com bateria e carregador', [bateria])).toBeNull();
    expect(resolveCategory('Bateria alcalina Duracell 9V', [bateria])?.family.id).toBe('bateria');
  });

  it('prefere a categoria mais específica presente na identidade', () => {
    const comum = profile({ id: 'garrafa', name: 'Garrafa', aliases: [], negativeTerms: [], modifiers: [] });
    const termica = profile({ id: 'garrafa-termica', name: 'Garrafa Térmica', aliases: [], negativeTerms: [], modifiers: [] });

    expect(resolveCategory('Garrafa térmica inox 1L', [comum, termica])?.family.id).toBe('garrafa-termica');
  });

  it('recusa candidatos empatados em vez de escolher arbitrariamente', () => {
    const first = profile({ id: 'fone-a', name: 'Fone de Ouvido', aliases: ['headset'], negativeTerms: [], modifiers: [] });
    const second = profile({ id: 'fone-b', name: 'Headset', aliases: ['fone de ouvido'], negativeTerms: [], modifiers: [] });
    const result = resolveCategoryDetailed('Headset gamer USB', [first, second]);

    expect(result.resolution).toBeNull();
    expect(result.diagnostics.reason).toBe('AMBIGUOUS_MATCH');
  });

  it('extrai uma única fonte canônica sem promover campo técnico a título', () => {
    const source = createProductSource('1704782\nEAN: 47891150106572\nCREME DENTAL ENLACE KIDS\nFornecedor: ACME');
    const missing = createProductSource('CARACTERÍSTICAS DO PRODUTO\nPotência: 1200 W\nVoltagem: 220 V\nFornecedor: ACME');

    expect(source).toMatchObject({
      title: 'CREME DENTAL ENLACE KIDS',
      titleSource: 'inferred-line',
      titleConfidence: 'medium',
    });
    expect(missing).toMatchObject({ title: '', titleSource: 'absent', titleConfidence: 'none' });
  });
});
