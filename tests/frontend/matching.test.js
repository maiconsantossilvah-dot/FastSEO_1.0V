import { describe, expect, it } from 'vitest';
import { bestMatch, rankMatches } from '../../src/utils/matching.js';

const categories = [
  { id: 'bottle', nome: 'Garrafa' },
  { id: 'thermal-bottle', nome: 'Garrafa Térmica' },
  { id: 'holder', nome: 'Suporte para Garrafa' },
];

describe('matching de categorias', () => {
  it('prefere a categoria mais específica presente no título', () => {
    const result = bestMatch('DESCRIÇÃO: Garrafa Térmica Inox 1 L\nEAN: 7891234567890', categories);

    expect(result?.id).toBe('thermal-bottle');
  });

  it('não trata o produto citado apenas como contexto como categoria principal', () => {
    const result = bestMatch('Suporte para garrafa em aço inox', categories);

    expect(result?.id).toBe('holder');
  });

  it('normaliza acentos e mantém o ranking determinístico', () => {
    const results = rankMatches('GARRAFA TERMICA de 1 litro', categories);
    const repeated = rankMatches('GARRAFA TERMICA de 1 litro', categories);

    expect(results[0].item.id).toBe('thermal-bottle');
    expect(results[0].score).toBeGreaterThan(0);
    expect(repeated.map(result => result.item.id))
      .toEqual(results.map(result => result.item.id));
  });
});
