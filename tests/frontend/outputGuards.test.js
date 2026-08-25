import { describe, expect, it } from 'vitest';
import {
  compactProductInput,
  stabilizeFichaOutput,
  validateFichaOutput,
} from '../../src/modules/outputGuards.js';

describe('compactProductInput', () => {
  it('normaliza quebras e remove apenas linhas vazias duplicadas', () => {
    expect(compactProductInput('Produto  \r\n\r\n\r\nEAN: 123\t\r\n'))
      .toBe('Produto\n\nEAN: 123');
  });
});

describe('stabilizeFichaOutput', () => {
  it('remove cercas Markdown e preserva o fornecedor literal no final', () => {
    const raw = 'Produto X\nFornecedor: EMPRESA S.A.';
    const generated = '```text\nProduto X\nFornecedor: Empresa alterada\n```';

    expect(stabilizeFichaOutput(raw, generated))
      .toBe('Produto X\n\nFornecedor: EMPRESA S.A.');
  });
});

describe('validateFichaOutput', () => {
  it('rejeita garantia inventada', () => {
    const result = validateFichaOutput('Produto X', 'Produto X\n\nGarantia: 12 meses');

    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ tipo: 'DADO_INVENTADO', campo: 'Garantia' }),
    ]));
  });

  it('aceita fornecedor literal na última linha', () => {
    const raw = 'Produto X\nFornecedor: EMPRESA S.A.';
    const ficha = 'Produto X\n\nFornecedor: EMPRESA S.A.';

    expect(validateFichaOutput(raw, ficha).errors).toEqual([]);
  });
});
