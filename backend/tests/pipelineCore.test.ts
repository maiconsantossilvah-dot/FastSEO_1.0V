import { describe, expect, it } from 'vitest';
import {
  a1Prompts,
  compactCategoryContract,
  numberedInputLines,
  renderTechnicalSheet,
  validateExtractedProduct,
} from '../src/pipeline/pipeline.core.js';
import type { CategoryResolution } from '../src/categories/types.js';
import type { ExtractedProduct } from '../src/pipeline/types.js';
import { extractionOutputBudget } from '../src/pipeline/pipeline.service.js';

function resolution(): CategoryResolution {
  return {
    family: { id: 'garrafa', name: 'Garrafa' },
    modifiers: [{ id: 'termica', name: 'Térmica' }],
    confidence: 0.92,
    score: 100,
    evidence: ['garrafa', 'térmica'],
    catalogVersion: 7,
    compiledProfile: {
      id: 'garrafa', name: 'Garrafa', status: 'published', profileType: 'compact', parentId: null,
      aliases: ['garrafinha'], negativeTerms: [], requiredFields: ['Marca', 'Capacidade'],
      optionalFields: ['Cor'], idealSheet: 'EXEMPLO MUITO LONGO QUE NÃO DEVE IR AO PROMPT',
      sheetNoticeType: 'normal', titleRule: { formula: 'Produto + Marca + Capacidade', example: 'Garrafa X 1L' },
      modifiers: [], qaSchema: null, schemaVersion: 2, revision: 1, source: 'manual',
    },
  };
}

function product(): ExtractedProduct {
  return {
    productName: 'Garrafa Térmica', brand: 'Termolar', model: '', color: 'Azul',
    codes: ['123'], eans: ['7891234567890'], supplier: 'Martins',
    facts: [
      { field: 'Capacidade', value: '1 Litro', sourceLines: [3], confidence: 'high', scope: 'common' },
    ],
  };
}

describe('pipeline otimizado', () => {
  it('dimensiona a saída do A1 sem usar o limite curto que truncava JSON', () => {
    expect(extractionOutputBudget('compact', 500)).toBe(2600);
    expect(extractionOutputBudget('technical', 20000)).toBe(8000);
  });

  it('gera contrato compacto sem enviar a ficha ideal completa', () => {
    const contract = compactCategoryContract(resolution());
    const prompts = a1Prompts(['Garrafa Térmica Termolar', 'Fornecedor: Martins'], contract);
    expect(contract?.modifiers).toEqual(['Térmica']);
    expect(prompts.user).toContain('Produto + Marca + Capacidade');
    expect(prompts.user).not.toContain('EXEMPLO MUITO LONGO');
  });

  it('dispensa o A2 quando os fatos possuem evidência suficiente', () => {
    const lines = numberedInputLines('Garrafa Térmica Termolar Azul\nCódigo: 123 | EAN: 7891234567890\nCapacidade: 1 Litro\nFornecedor: Martins');
    const validation = validateExtractedProduct(product(), lines, compactCategoryContract(resolution()));
    expect(validation.needsAiReview).toBe(false);
    expect(validation.missingRequired).toEqual([]);
  });

  it('aciona o A2 para fato sem apoio nas linhas citadas', () => {
    const lines = numberedInputLines('Garrafa Térmica Termolar\nCapacidade: 1 Litro\nFornecedor: Martins');
    const changed = product();
    changed.facts[0] = { field: 'Capacidade', value: '5 Litros', sourceLines: [2], confidence: 'high', scope: 'common' };
    const validation = validateExtractedProduct(changed, lines, compactCategoryContract(resolution()));
    expect(validation.needsAiReview).toBe(true);
    expect(validation.reviewReasons).toContain('UNSUPPORTED_FACT');
  });

  it('aciona o A2 quando marca, código ou EAN não existem nos dados brutos', () => {
    const lines = numberedInputLines('Garrafa Térmica\nCapacidade: 1 Litro\nFornecedor: Martins');
    const validation = validateExtractedProduct(product(), lines, compactCategoryContract(resolution()));
    expect(validation.needsAiReview).toBe(true);
    expect(validation.reviewReasons).toContain('IDENTITY_NOT_IN_RAW');
  });

  it('monta a ficha por código e marca obrigatório ausente como não informado', () => {
    const lines = numberedInputLines('Garrafa Térmica\nCapacidade: 1 Litro\nFornecedor: Martins');
    const changed = { ...product(), brand: '' };
    const validation = validateExtractedProduct(changed, lines, compactCategoryContract(resolution()));
    const sheet = renderTechnicalSheet(changed, compactCategoryContract(resolution()), validation);
    expect(sheet).toContain('Marca: Não informado');
    expect(sheet).toContain('Capacidade: 1 Litro');
    expect(sheet).toContain('Fornecedor: Martins');
  });

  it('não trunca fichas técnicas com mais de 20 mil caracteres', () => {
    const largeProduct = product();
    largeProduct.facts = Array.from({ length: 100 }, (_, index) => ({
      field: `Especificação ${index + 1}`,
      value: `${String(index + 1).padStart(3, '0')} ${'detalhe técnico '.repeat(14)}`,
      sourceLines: [1],
      confidence: 'high' as const,
      scope: 'common' as const,
    }));
    const validation = { issues: [], missingRequired: [], confirmedFields: [], needsAiReview: false, reviewReasons: [] };
    const sheet = renderTechnicalSheet(largeProduct, compactCategoryContract(resolution()), validation);
    expect(sheet.length).toBeGreaterThan(20000);
    expect(sheet).toContain('Especificação 100');
  });
});
